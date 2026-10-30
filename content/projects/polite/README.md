---
cover: chip.png
---

# POLITE — 4×4 int8 matrix unit for Tiny Tapeout

**Hook:** A pad-fed 4×4 int8 matrix tile for Tiny Tapeout: 16 PEs with 2 MACs each, single-edge clocking, a cycle-accurate C golden model and matching Verilog RTL. The 66 MHz (15.15 ns) clock is an STA and pin-budget target, not a measured clock. Results leave at one byte every 2 clocks to respect the 33 MHz pad-out rating.

## What it is

POLITE is a 4×4 int8 matrix unit designed for Tiny Tapeout. One operand panel stays on chip; the other streams in over a 16-bit pad bus, 2 bytes per beat. The array is 16 PEs, and each PE does 2 MACs per clock (32 MACs per clock in total), keeping a 24-bit partial sum. A finished tile leaves as sixteen 32-bit words through a decimate-by-2 output: a rising-edge output register presents a new result byte on `uo_out` at most once every 2 clocks and holds it for the board's capture 2 cycles later (`OUT_MCP=2`).

I wrote this for Rev Silicon’s first-chip effort. The architecture (widths, resident panels, single-edge pad protocol) is intended to be open. Full RTL is not mirrored on this site.

## My role

Sole designer of the POLITE core: golden model in C (`polite/src/chip.c`), Verilog RTL under `rtl/`, cosimulation testbenches, and architecture docs/diagrams.

## Tech

- Verilog (Tiny Tapeout top `tt_um_polite.v`)
- C11 golden model + Makefile cosim (iverilog / vvp)
- sky130 2 kB SRAM macros for the operand store

## Key points

- Single-edge clocking: one pad beat is one `clk` period and every flop is a rising-edge flop. The earlier design ran a rise tick and a fall tick per beat; now both ticks are computed in one clock, still cycle-exact with the C model.
- 16 PEs × 2 MACs = 32 MACs per clock, carry-save accumulation.
- Output is decimated by 2 on the rising edge (`OUT_MCP=2`): one result byte per 2 clocks. Tiny Tapeout rates pad inputs at 66 MHz but outputs at 33 MHz, so a new byte every 2 clocks at a 66 MHz clock is the 33 MHz equivalent.
- Reset is released through a two-flop rising-edge synchronizer and then fanned out as registered broadcast copies (24 reset copies), so no single reset net drives the whole design.
- Docs walk the block diagram, command encoding, and where RTL differs from the earlier sketches.

## Dates

September 2026 (active). Git history on the org remote starts 2026-09-21.

## Links

Architecture will be public with the Tiny Tapeout / Rev Silicon release. The org repo is currently private — no public GitHub link here yet.

## Figures

- `chip.png`
- `polite-array-flow.png`
- `polite-both-edges.png` — historical: the earlier dual-edge protocol, replaced by single-edge clocking
- `polite-commands.png`
- `polite-input-buffering.png`
- `polite-old-block-diagram.png` — earlier sketch, not the current RTL
- `polite-rp2350-tiling.png`
- `polite-sram-capture.png`
- `polite-usb-speeds.png`
