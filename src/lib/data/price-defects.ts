/**
 * priceDefects() moved into adapters.ts on 2026-09-28: interpretOffer(), which
 * offerToAnonymousDeal() calls, marks a defective row `check`, and this module importing adapters
 * while adapters imported it back was a cycle. Kept so the price gate and its tests import it by
 * the name they always have. The defect list and its reasons are documented at the function.
 */
export { type PriceDefect, priceDefects } from './adapters'
