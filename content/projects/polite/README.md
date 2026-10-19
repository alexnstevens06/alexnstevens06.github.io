---
cover: chip.png
---

# POLITE — 4×4 int8 matrix unit for Tiny Tapeout

**Hook:** A pad-fed 4×4 int8 matrix tile for Tiny Tapeout, with a cycle-accurate C golden model and matching SystemVerilog RTL. The pad-clock target is 66 MHz (15.15 ns) for STA and the pin budget, not a measured clock. At that target the inbound pin rate is 132000000 bytes/s (2 bytes per beat).

## What it is

POLITE is a 4×4 int8 matrix unit designed for Tiny Tapeout. One operand panel stays on chip; the other streams through the pad bus one beat at a time. Each PE keeps a 24-bit partial sum. A finished tile leaves as sixteen 32-bit words, one result byte per beat on `uo_out`.

I wrote this for Rev Silicon’s first-chip effort. The architecture (widths, resident panels, dual-edge pad protocol) is intended to be open. Full RTL is not mirrored on this site.

## My role

Sole designer of the POLITE core: golden model in C (`polite/src/chip.c`), SystemVerilog RTL under `rtl/`, cosimulation testbench, and architecture docs/diagrams.

## Tech

- SystemVerilog (Tiny Tapeout top `tt_um_polite.v`)
- C11 golden model + Makefile cosim (iverilog / vvp)
- Behavioral stand-in for sky130 2 kB SRAM macros

## Key points

- Pad beat = one `clk` period; rising edge samples the bus and starts compute, falling edge continues.
- Three `sky130_sram_2kbyte_1rw1r_32x512_8` macros for the operand store (behavioral model in `rtl/polite_mem.v`).
- Docs walk the block diagram, command encoding, and where RTL differs from the earlier sketch.

## Dates

September 2026 (active). Git history on the org remote starts 2026-09-21.

## Links

Architecture will be public with the Tiny Tapeout / Rev Silicon release. The org repo is currently private — no public GitHub link here yet.

## Figures

- `chip.png`
- `polite-array-flow.png`
- `polite-both-edges.png`
- `polite-commands.png`
- `polite-input-buffering.png`
- `polite-old-block-diagram.png` — earlier sketch, not the current RTL
- `polite-rp2350-tiling.png`
- `polite-sram-capture.png`
- `polite-usb-speeds.png`
