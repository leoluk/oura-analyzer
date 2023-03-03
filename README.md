# oura-analyzer

Simple Oura ring data visualizer, and an example of how simple modern frontend
development can be without any build tools.

Built on:

- [Lit](https://lit.dev/) for templating and reactivity.
- [Observable Plot](https://observablehq.com/@observablehq/plot) for the pretty graphs.
- [Shoelace](https://shoelace.style/) for the UI components.
- A few dozen lines of CSS for the rest.

Works everywhere, except IE11. 

Lighthouse score is 98 even though there's no build step, no bundling, no
minification, no tree shaking, no nothing.
