
# Occupancy Zero Revert Fix - Verification Guide

The P0 bug where occupancy counts revert to 0 has been addressed. This was caused by two main issues:
1. **Self-Healing Race Condition**: A backend process was detecting "missing" snapshots and creating them with `0` occupancy, sometimes overwriting valid data during hydration.
2. **Default-to-Zero Logic**: The frontend store was interpreting `undefined` occupancy as `0`, forcing a render of "0" before real data arrived.

## Fixes Implemented
- **Removed Dangerous Self-Healing**: Commented out the `api/sync` logic that auto-seeds 0 snapshots.
- **Removed Store Zero Default**: `store.tsx` now respects `undefined` (and renders `—` or preserves previous value) instead of forcing 0.
- **Added Safety Checks**: `recordEvent` now logs UI state for debugging.

## How to Verify (Manual Acceptance Test)

Since the automated end-to-end environment has authentication instabilities, please perform this manual test:

1. **Login & Setup**:
   - Log into the app.
   - Go to a Clicr page (e.g. `/clicr/your_device_id`).
   - Open `/debug` in a second tab.

2. **The "Wait" Test**:
   - On the Clicr page, increment the count (e.g. tap +1 three times).
   - Ensure the count updates (e.g. shows "3").
   - **WAIT 5 SECONDS**.
   - **Verify**: The count must Stay at "3". It must NOT jump back to 0.

3. **The "Refresh" Test**:
   - Reload the Clicr page.
   - **Verify**: The count should load as "3" (or whatever value you left it at). It should NOT briefly show 0 and then 3, nor show 0 permanently.

4. **Debug Validation**:
   - Check `/debug` tab.
   - Click "Fetch Truth".
   - Verify that the "Occupancy Snapshots" table shows the correct non-zero value for your area.
