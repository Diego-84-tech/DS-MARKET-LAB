// Kalshi numeric strike tickers legitimately contain decimal points.
export function validTicker(value){return typeof value==='string'&&/^[A-Z0-9][A-Z0-9._-]{0,149}$/.test(value)&&!value.includes('..');}
