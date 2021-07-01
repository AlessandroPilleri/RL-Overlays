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

  flag = false;
  WsSubscribers.init(49322, true);
  WsSubscribers.subscribe("game", "statfeed_event", (d) => {
    $(".statfeed .lista").append("<tr><td>" + d['main_target']['name'] + " " + d['type'] + "</td></tr>");
    setTimeout(() => {
      $(".statfeed .lista tr:first-child").remove();
    }, 3500);

  })
  WsSubscribers.subscribe("game", "update_state", (d) => {

    // Scoreboard

    $(".scoreboard .team1 .teamName").text(d['game']['teams'][0]['name']);
    $(".scoreboard .team2 .teamName").text(d['game']['teams'][1]['name']);
    $(".scoreboard .teamScore .team1Score").text(d['game']['teams'][0]['score']);
    $(".scoreboard .teamScore .team2Score").text(d['game']['teams'][1]['score']);
    minutes = Math.trunc(d['game']['time'] / 60);
    seconds = Math.ceil(d['game']['time'] % 60);

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
    $(".scoreboard .time").text(minutes + " " + (seconds<10?'0':'') + seconds);

    // Player lists

    i = 1;

    Object.keys(d['players']).forEach((e) => {

      if (d['players'][e].team == 0) {
        $(".team1players .player" + i + " .name").text(d['players'][e]['name']);
        $(".team1players .player" + i + " .boost").text(d['players'][e]['boost']);
      } else {
        $(".team2players .player" + i + " .name").text(d['players'][e]['name']);
        $(".team2players .player" + i + " .boost").text(d['players'][e]['boost']);
      }

      i++;
      if (i == 4) {
        i = 1;
      }
    });

    // Player info
    if (d['game']['target']) {
      $(".playerinfo .name").text(d['players'][d['game']['target']]['name']);
      $(".playerinfo .score").text(d['players'][d['game']['target']]['score']);
      $(".playerinfo .goals").text(d['players'][d['game']['target']]['goals']);
      $(".playerinfo .assists").text(d['players'][d['game']['target']]['assists']);
      $(".playerinfo .shots").text(d['players'][d['game']['target']]['shots']);
      $(".playerinfo .saves").text(d['players'][d['game']['target']]['saves']);
      $(".playerinfo .demos").text(d['players'][d['game']['target']]['demos']);
    }

  })
});
