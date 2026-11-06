# Self-hosted Judge0

NexClass sends code to a Judge0 instance administered by the college. Compose pins `judge0/judge0:1.13.1`, and publishes the API only on `127.0.0.1:2358`; apps on the LAN cannot access Judge0 directly.

## Configure and start

Copy `judge0.conf.example` to `.env`, replace the Redis and PostgreSQL passwords with separate random values, and set a long random `AUTHN_TOKEN`. Keep `.env` private. Start dependencies first, then the runner:

```sh
docker compose up -d db redis
docker compose up -d
```

Set the HOD server environment to `CODE_RUNNER=judge0`, `JUDGE0_URL=http://127.0.0.1:2358`, `JUDGE0_AUTH_TOKEN=<same value as AUTHN_TOKEN>`, and `CODE_MAX_CONCURRENT=4`, then restart the HOD server.

## Verify

Run on the server machine. The response should indicate Accepted and contain `aGkK` (base64 for `hi\n`) in stdout:

```sh
curl -sS -X POST 'http://127.0.0.1:2358/submissions?base64_encoded=true&wait=true' \
  -H 'Content-Type: application/json' -H 'X-Auth-Token: YOUR_AUTHN_TOKEN' \
  --data '{"language_id":71,"source_code":"cHJpbnQoImhpIik=","stdin":""}'
```

## Windows

Install Docker Desktop, enable WSL2, open PowerShell in this directory, run `Copy-Item judge0.conf.example .env`, set the passwords and token, then run the commands above. Verify with `curl.exe`. Compatibility depends on the host kernel and virtualization setup.

## Ubuntu

Install Docker Engine and the Compose plugin, copy the config template to `.env`, set secrets, then start the stack as above. Check the current official Judge0 deployment requirements for your Linux kernel before enabling code execution.

## TROUBLESHOOTING

Judge0's sandbox requires privileged containers, so this compose file gives that privilege to the Judge0 server and workers. Keep its published API loopback-only. Judge0 has had cgroup v1 versus v2 compatibility problems on newer Linux kernels and Docker versions. The official release notes state it has only been tested on Linux and give Ubuntu/cgroup guidance; check the current [official Judge0 documentation](https://github.com/judge0/judge0) for current requirements. If submissions return `Internal Error`, inspect `docker compose logs server workers db redis`, check the cgroup configuration, and follow upstream guidance. This setup is not guaranteed to work everywhere.

Code execution remains disabled unless the HOD server is explicitly configured with a private Judge0 URL.
