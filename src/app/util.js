export const DEFAULT_RENDER_OPTIONS = {parenthesis: 'auto', implicit: 'hide'};
export const EXPRESSION_TO_MATHJAX = (d,o) => '\\(' + d.toTex(o || DEFAULT_RENDER_OPTIONS) + '\\)';

