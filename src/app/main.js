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
