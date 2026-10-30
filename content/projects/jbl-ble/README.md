---
cover: jbl-ble-protocol.png
---

# JBL Charge 5 — BLE protocol

**Hook:** Decompiling the JBL app, looking for unused functionality, and reverse engineering the communication protocol.

## What it is

I decompiled the JBL app, looked through it for unused functionality, and reverse engineered the communication protocol it uses with a Charge 5. The figure is that protocol diagram, from the personal probe scripts `ble_probe.py` and `ble_one.py` under `Documents/code/useful/jblusb`. Vendor `certs/` are not published.

## My role

Author of the probe scripts and the protocol notes taken from the decompiled app.

## Tech

Python 3, bleak, asyncio.

## Dates

August 2026 (mtime on `ble_probe.py` ~2026-08-30 CT).

## Links

None public.
