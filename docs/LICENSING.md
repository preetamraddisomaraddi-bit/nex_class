# NexClass offline licensing

## Create the vendor signing key

From `tools/license-generator`, run `node cli.js keygen --id k1`. This creates an Ed25519 private/public key pair in `keys/` and prints the public PEM. The private key is ignored by Git and is never part of a customer app. Paste the public PEM into `nexclass-hod/server/license/publicKeys.js` in the map entry for `k1`, then release the server/app update. Keep old public key entries when rotating keys so existing licenses continue to verify.

## Issue and deliver a license

Run `node cli.js issue --college "ABC Institute of Technology" --students 500 --teachers 40 --expires 2027-11-30 --features exams,codeRunner,ai --plan standard --key k1`. The signed `.nexlicense` file and `issued.csv` are written under `tools/license-generator/out/`. Send the `.nexlicense` file to the college contact. The HOD imports it from the License page or pastes its JSON contents.

Run `node cli.js verify out/NX-YYYY-NNNN.nexlicense` to verify a license with the matching vendor public key before delivery.

## Renewal and state behavior

To renew, issue a new license with the same key and a later `issuedAt`, then activate the new file in the HOD app. No reinstall is required. An expired license has a 14-day grace period with full functionality and a warning banner. After grace, the server becomes read-only: viewing and exports remain available, while registrations, new rooms, exams, code execution and AI hints are blocked until a license is activated. During a 30-day first-run trial, seat limits are 30 students and 3 approved teachers.

The license college name is informational. The HOD app warns if it differs from the department university name but does not block activation.

## Protect vendor keys

**Back up `tools/license-generator/keys/*.private.pem` offline in at least two secure locations. Never commit, email, or package a private key. If the signing private key is lost, licenses can no longer be issued with it; a new public key must be added to the server and delivered in an app update before new licenses can be activated.**
