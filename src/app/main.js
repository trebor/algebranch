// require("bower_components/bootstrap/dist/js/bootstrap.min.js");
import bs from "bootstrap";
console.log("bs", bs);

import Algebranch from './Algebranch.js';

const interval = setInterval((x) => {
  let started = false;
  if (window.MathJax) {
    clearInterval(interval);
    MathJax.Hub.signal.Interest(
      function (message, a, b) {
        if (!started && message[0] == 'End Process') {
          MathJax.Callback.Queue([() => {
            new Algebranch()
            started = true;
          }]);
        }
      }
    );
  }
}, 200);
