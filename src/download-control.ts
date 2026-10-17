// Tinycast exposes buffered execFile, so control the isolated download job through
// a small shell supervisor and a file. All external values are positional args.
// The job runs in its own process group and records its PID, so a reopened command
// can find it, check it is alive and signal it even if this supervisor is gone.
// The exit code is written to the status file; success plays the Glass sound here,
// so it sounds even when the command was closed during the download.
export const downloadSupervisor = `
set -m
log="$1"; control="$2"; status="$3"; pidfile="$4"; shift 4
# After the command closes, the supervisor's own stdout/stderr pipes are broken; a job
# notice ("Terminated") written there would kill it with SIGPIPE before it records the result.
exec >/dev/null 2>&1
"$@" >"$log" 2>&1 &
job=$!
echo "$job" >"$pidfile"
last=running
while kill -0 "$job" 2>/dev/null; do
  desired=$(cat "$control" 2>/dev/null)
  if [ "$desired" = stop ]; then
    kill -TERM -"$job" 2>/dev/null
    kill -CONT -"$job" 2>/dev/null
    sleep 1
    kill -KILL -"$job" 2>/dev/null
    wait "$job" 2>/dev/null
    echo 130 >"$status"
    exit 130
  fi
  if [ "$desired" = paused ] && [ "$last" != paused ]; then
    kill -STOP -"$job" 2>/dev/null
    last=paused
  elif [ "$desired" = running ] && [ "$last" = paused ]; then
    kill -CONT -"$job" 2>/dev/null
    last=running
  fi
  sleep 0.2
done
wait "$job"
code=$?
echo "$code" >"$status"
[ "$code" = 0 ] && /usr/bin/afplay /System/Library/Sounds/Glass.aiff >/dev/null 2>&1
exit "$code"
`;
