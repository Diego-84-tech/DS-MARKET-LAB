# DS Market Lab

Paper trading only. Never add real order submission as a routine implementation step.
Each wallet starts with $50; profits and returned principal are reusable. Wallet A has a $10 per-position entry limit. Wallet B has no fixed position limit, but cannot spend more than its available cash. Count estimated entry fees within these limits. No automatic refills. Resets create new sessions and retain existing records.
All built-in scenarios are fictional, deterministic practice data, and use a transparent rule signal, not an AI forecast. Preserve this label throughout the UI and exports. Never label them a backtest, live feed, or performance evidence.
Secrets stay outside the frontend, repository, downloads, and exports. Mac key provisioning is deferred until Diego is home. Do not modify DS HUB or production Supabase from this project without resolving their exact targets.
Product name DS Market Lab is approved. App icon artwork is awaiting approval; do not invent or ship final icon artwork. Wire approved artwork into browser/PWA/desktop targets when supplied. No installable PWA is shipped in this first version.
Use integer cents for money and hundredths of a contract for quantities. Keep raw data timestamps and strategy versions so replay never introduces later information into earlier decisions.

Strategy Lab uses user-authored deterministic rules only. Its evaluations and replay sessions are separate from the original recorded wallet history. Saved strategy versions are immutable; copy to a draft to change them. History ranges show only available reached frames. Never stitch separate expiring contract price lines together as one continuous instrument. Version 0.2.0 adds editable sources to Diego-84-tech/DS-MARKET-LAB; netlify.toml builds/tests dist directly and supersedes the old ZIP extraction command. Preserve the original uploaded ZIP as an archive, not the active source.
