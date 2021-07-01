const WsSubscribers = {
  __subscribers: {},
  websocket: undefined,
  webSocketConnected: false,
  registerQueue: [],
  init: function(port, debug, debugFilters) {
      port = port || 49322;
      debug = debug || false;
      if (debug) {
          if (debugFilters !== undefined) {
              console.warn("WebSocket Debug Mode enabled with filtering. Only events not in the filter list will be dumped");
          } else {
              console.warn("WebSocket Debug Mode enabled without filters applied. All events will be dumped to console");
              console.warn("To use filters, pass in an array of 'channel:event' strings to the second parameter of the init function");
          }
      }
      WsSubscribers.webSocket = new WebSocket("ws://localhost:" + port);
      WsSubscribers.webSocket.onmessage = function (event) {
          let jEvent = JSON.parse(event.data);
          if (!jEvent.hasOwnProperty('event')) {
              return;
          }
          let eventSplit = jEvent.event.split(':');
          let channel = eventSplit[0];
          let event_event = eventSplit[1];
          if (debug) {
              if (!debugFilters) {
                  console.log(channel, event_event, jEvent);
              } else if (debugFilters && debugFilters.indexOf(jEvent.event) < 0) {
                  console.log(channel, event_event, jEvent);
              }
          }
          WsSubscribers.triggerSubscribers(channel, event_event, jEvent.data);
      };
      WsSubscribers.webSocket.onopen = function () {
          WsSubscribers.triggerSubscribers("ws", "open");
          WsSubscribers.webSocketConnected = true;
          WsSubscribers.registerQueue.forEach((r) => {
              WsSubscribers.send("wsRelay", "register", r);
          });
          WsSubscribers.registerQueue = [];
      };
      WsSubscribers.webSocket.onerror = function () {
          WsSubscribers.triggerSubscribers("ws", "error");
          WsSubscribers.webSocketConnected = false;
      };
      WsSubscribers.webSocket.onclose = function () {
          WsSubscribers.triggerSubscribers("ws", "close");
          WsSubscribers.webSocketConnected = false;
      };
  },
  /**
   * Add callbacks for when certain events are thrown
   * Execution is guaranteed to be in First In First Out order
   * @param channels
   * @param events
   * @param callback
   */
  subscribe: function(channels, events, callback) {
      if (typeof channels === "string") {
          let channel = channels;
          channels = [];
          channels.push(channel);
      }
      if (typeof events === "string") {
          let event = events;
          events = [];
          events.push(event);
      }
      channels.forEach(function(c) {
          events.forEach(function (e) {
              if (!WsSubscribers.__subscribers.hasOwnProperty(c)) {
                  WsSubscribers.__subscribers[c] = {};
              }
              if (!WsSubscribers.__subscribers[c].hasOwnProperty(e)) {
                  WsSubscribers.__subscribers[c][e] = [];
                  if (WsSubscribers.webSocketConnected) {
                      WsSubscribers.send("wsRelay", "register", `${c}:${e}`);
                  } else {
                      WsSubscribers.registerQueue.push(`${c}:${e}`);
                  }
              }
              WsSubscribers.__subscribers[c][e].push(callback);
          });
      })
  },
  clearEventCallbacks: function (channel, event) {
      if (WsSubscribers.__subscribers.hasOwnProperty(channel) && WsSubscribers.__subscribers[channel].hasOwnProperty(event)) {
          WsSubscribers.__subscribers[channel] = {};
      }
  },
  triggerSubscribers: function (channel, event, data) {
      if (WsSubscribers.__subscribers.hasOwnProperty(channel) && WsSubscribers.__subscribers[channel].hasOwnProperty(event)) {
          WsSubscribers.__subscribers[channel][event].forEach(function(callback) {
              if (callback instanceof Function) {
                  callback(data);
              }
          });
      }
  },
  send: function (channel, event, data) {
      if (typeof channel !== 'string') {
          console.error("Channel must be a string");
          return;
      }
      if (typeof event !== 'string') {
          console.error("Event must be a string");
          return;
      }
      if (channel === 'local') {
          this.triggerSubscribers(channel, event, data);
      } else {
          let cEvent = channel + ":" + event;
          WsSubscribers.webSocket.send(JSON.stringify({
              'event': cEvent,
              'data': data
          }));
      }
  }
};

///

$(() => {

  $(".replaybar").hide();

  flag = false;
  teams = [];
  id = 1000;
  goalSpeed = 0;
  goalFlag = false;
  goalTeam = -1;

  WsSubscribers.init(49322, true);
  WsSubscribers.subscribe("game", "statfeed_event", (d) => {

    statfeedBackground = "";
    statfeed = false;
    if (d['type'] == "Tiro in porta") {
      statfeed = true;
      statfeedBackground = "template/tiro.png";
    }
    if (d['type'] == "Gol") {
      statfeed = true;
      statfeedBackground = "template/goal.png";
    }
    if (d['type'] ==  "Parata" || d['type'] == "Parata epica") {
      statfeed = true;
      statfeedBackground = "template/parata.png";
    }
    if (d['type'] == "Demolizione") {
      statfeed = true;
      statfeedBackground = "template/explosion.png";
    }

    $(".statfeed .lista").append("<tr><td id=\""+ id +"\" \"class=\"evento\"><div id=\"name" + id + "\" class=\"name text-right\">" + teams[d['main_target']['team_num']]['name'] + "</div></td></tr>");
    $("#" + id).css('background-image', 'url(' + statfeedBackground + ')');
    $("#" + id).css('background-repeat', 'no-repeat');
    $("#" + id).css('width', '187px');
    $("#" + id).css('height', '36px');
    $("#name" + id).css('color', 'white');
    $("#name" + id).css('font-weight', '700');
    $("#name" + id).css('padding-right', '10px');
    $("#name" + id).css('padding-bottom', '3px');
    id++;
    setTimeout(() => {
      $(".statfeed .lista tr:first-child").remove();
    }, 3500);

    if (d['type'] == 'Gol') {
      goalFlag = true;
      goalTeam = d['main_target']['team_num'];
    }


  })
  WsSubscribers.subscribe("game", "update_state", (d) => {

    teams.push(d['game']['teams'][0]);
    teams.push(d['game']['teams'][1]);

    // Scoreboard

    $(".scoreboard .team1 .teamName").text(d['game']['teams'][0]['name']);
    $(".scoreboard .team2 .teamName").text(d['game']['teams'][1]['name']);
    $(".scoreboard .teamScore .team1Score").text(d['game']['teams'][0]['score']);
    $(".scoreboard .teamScore .team2Score").text(d['game']['teams'][1]['score']);

    /*minutes = Math.trunc(d['game']['time_seconds'] / 60);
    seconds = Math.ceil(d['game']['time_seconds'] % 60);

    if (seconds == 60 && minutes > 0) {
      minutes++;
      seconds = 0;
    }
    if (flag == false) {
      if (minutes == 0 && seconds == 0) {
        flag = true;
      }
    }
    if (flag == true) {
      seconds = Math.floor(d['game']['time'] % 60);
    }

    $(".scoreboard .time").text(minutes + ":" + (seconds<10?'0':'') + seconds);
    if (minutes == 0 && seconds == 0) {
      $(".scoreboard .time").text("0:00");
    }
    */
    var min = ~~((d['game']['time_seconds'] % 3600) / 60);
    var sec = d['game']['time_seconds'] % 60;
    var sec_min = "";
    sec_min += "" + min + ":" + (sec < 10 ? "0" : "");
    sec_min += "" + sec;
    $(".scoreboard .time").text(sec_min);

    // Player lists

    Object.keys(d['players']).forEach(e => {

      if (d['players'][e].team == 0) {
        $(".team1players .player1 .name").text(d['game']['teams'][0]['name']);
        $("#blue-player-1-p-bar").width(100 - d['players'][e]['boost'] + "%");
        //$("#blue-player-1-boost").text(d['players'][e]['boost']);

        /*if (d['players'][e]['boost'] >= 80) {
          $(".team1players .player1 .progress-bar").css('background-image', 'linear-gradient(to right, red, blue)');
        }
        if (d['players'][e]['boost'] >= 50 && d['players'][e]['boost'] < 80) {
          $(".team1players .player1 .progress-bar").css('background-image', 'linear-gradient(to right, orange, red)');
        }
        if (d['players'][e]['boost'] >= 20 && d['players'][e]['boost'] < 50) {
          $(".team1players .player1 .progress-bar").css('background-image', 'linear-gradient(to right, yellow, orange)');
        }
        if (d['players'][e]['boost'] < 20) {
          $(".team1players .player1 .progress-bar").css('background-image', 'linear-gradient(to right, white, yellow)');
        }*/

      } else {
        $(".team2players .player2 .name").text(d['game']['teams'][1]['name']);
        $("#orange-player-1-p-bar").width(100 - d['players'][e]['boost'] + "%");
        //$("#orange-player-1-boost").text(d['players'][e]['boost']);

        /*if (d['players'][e]['boost'] >= 80) {
          $(".team2players .player2 .progress-bar").css('background-image', 'linear-gradient(to right, red, blue)');
        }
        if (d['players'][e]['boost'] >= 50 && d['players'][e]['boost'] < 80) {
          $(".team2players .player2 .progress-bar").css('background-image', 'linear-gradient(to right, orange, red)');
        }
        if (d['players'][e]['boost'] >= 20 && d['players'][e]['boost'] < 50) {
          $(".team2players .player2 .progress-bar").css('background-image', 'linear-gradient(to right, yellow, orange)');
        }
        if (d['players'][e]['boost'] < 20) {
          $(".team2players .player2 .progress-bar").css('background-image', 'linear-gradient(to right, white, yellow)');
        }*/
      }
    });

    // Player looking

    playersList = Object.keys(d['players']);
    console.log(playersList);

    if (d['game']['target']) {

      console.log(d['game']['target']);
      if (d['game']['target'] == playersList[0]) {
        $(".player1 .looking").show();
        $(".player2 .looking").hide();
      }

      if (d['game']['target'] == playersList[1]) {
        $(".player2 .looking").show();
        $(".player1 .looking").hide();
      }

    } else {
      $(".player1 .looking").hide();
      $(".player2 .looking").hide();
    }

    // Replay bar

    if (goalFlag == true) {
      goalSpeed = d['game']['ball']['speed'];
      goalFlag = false;
    }

    if (d['game']['isReplay'] == true && d['game']['teams'][goalTeam]) {
      $(".replaybar").show();
      $(".replaybar .name").text(d['game']['teams'][goalTeam]['name']);
      $(".replaybar .speed").text(goalSpeed + ' Km/h');
    } else {
      $(".replaybar").hide();
    }

  })
});
