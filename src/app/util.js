import $ from 'jquery';

export const DEFAULT_RENDER_OPTIONS = {
  parenthesis: 'auto', // all
  implicit: 'hide'
};
export const EXPRESSION_TO_MATHJAX_INLINE = (d, o) => '\\(' + d.toTex(o || DEFAULT_RENDER_OPTIONS) + '\\)';
export const EXPRESSION_TO_MATHJAX = (d, o) => '$$' + d.toTex(o || DEFAULT_RENDER_OPTIONS) + '$$';

export function applyExpression($element, expression, isInline, callback) {
  const toMathJax = isInline
    ? EXPRESSION_TO_MATHJAX_INLINE
    : EXPRESSION_TO_MATHJAX;

  const computeSize = isInline
    ? ComputeInlineExpressionSize
    : ComputeExpressionSize;

  $element.text(toMathJax(expression));
  const id = '#' + $element.attr('id');

  MathJax.Callback.Queue(
    [
      'Typeset',
      MathJax.Hub,
      $element.get(0),
      () => {callback(computeSize($element))},
    ],
  );
}

export function ComputeExpressionSize($element) {
  const $mjx = $element.find('.mjx-chtml');
  const $n1 = $($mjx[0]);
  const $n2 = $($mjx[1]);

  return {
    width: $n2.outerWidth()
      + parseInt($n1.css('margin-left'))
      + parseInt($n1.css('margin-right'))
      + parseInt($n1.css('padding-left'))
      + parseInt($n1.css('padding-right')),
    height: $n2.outerHeight()
      + parseInt($n1.css('margin-top'))
      + parseInt($n1.css('margin-bottom'))
      + parseInt($n1.css('padding-top'))
      + parseInt($n1.css('padding-bottom')),
  };
}

export function ComputeInlineExpressionSize($element) {
  const $mjx = $element.find('.mjx-chtml');
  const $n1 = $($mjx[0]);

  return {
    width: $n1.outerWidth()
      + parseInt($n1.css('margin-left'))
      + parseInt($n1.css('margin-right'))
      + parseInt($n1.css('padding-left'))
      + parseInt($n1.css('padding-right')),
    height: $n1.outerHeight()
      + parseInt($n1.css('margin-top'))
      + parseInt($n1.css('margin-bottom'))
      + parseInt($n1.css('padding-top'))
      + parseInt($n1.css('padding-bottom')),
  };
}
