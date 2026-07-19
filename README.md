## Description

This webpage serves as a repository for the presentation materials and links I will be discussing at [JuliaCon 2026](https://juliacon.org/2026/).

- [Slide](slide/slide.html)
  - We implemented a Rust-based virtual machine that accepts and executes a subset of Julia syntax. This enables Julia code to run in environments where the official runtime is difficult to deploy. By compiling the VM to WebAssembly, Julia can run web apps for educational purposes, and static linking with Swift or Flutter allows mobile applications. This short talk demonstrates these capabilities through live demos.

## Appendix

- This page is built using [Quarto](https://quarto.org/). The `qmd` files are maintained at [this repository](https://github.com/AtelierArith/AtelierArith_JuliaCon2026_talk). Readers are free to use these materials for educational and research purposes.

## How to launch locally

Install [Quarto](https://quarto.org/). Then run the following command:

```
$ quarto preview
```
