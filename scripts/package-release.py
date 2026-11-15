"""Cloud release requires Git-connected Netlify build; static ZIP would omit the worker."""
raise SystemExit("DS Market Lab 0.6.0 is server-backed. Deploy the Git repository; a static Netlify ZIP is not a complete release.")
