Rebase the current branch onto origin/main and push it.

1. `git branch --show-current`. If it prints `main`, stop: "refusing to sync on main".
2. `git fetch origin && git rebase origin/main`.
3. On each conflict, for every conflicted file (`git diff --name-only --diff-filter=U`):
   - `js/world.js` with a conflict inside `genWorld()`: stop mid-rebase. Report the file. Do not touch it.
   - `js/ui/menu.js` at `PATCH_TXT` / `PATCH_NOTES`: keep both notes, ours above main's. Set `PATCH_TXT` to main's value + 0.01. Amend the commit message so its patch name matches.
   - Any other file: keep both sides' intent.
   Remove every conflict marker. `git add` the file.
   Run `for f in $(git ls-files 'js/*.js'); do node --check "$f" || exit 1; done` (every file under `js/`, subfolders included). On failure: stop mid-rebase. Report the file and the error.
   Run `node app/check-globals.js`. On failure: stop mid-rebase. Report its output.
   `git rebase --continue`.
4. If a conflict cannot be resolved: stop mid-rebase. Report the file.
5. Never `git rebase --abort`. Never `git reset --hard`.
6. Once the rebase is done, conflicts or not, run `node app/check-globals.js`: a clean rebase is exactly where two branches' same-named globals meet. On failure: do not push. Report its output (each collision names both files and lines).
7. `git push --force-with-lease`. Never `--force`.
8. Report each resolution in one line: `<file>: <what was kept>`.
