"""Checks for provisioning/provision-server.py's teardown bookkeeping (run_destroy,
teardown_result, the per-slug create/destroy lock), with destroy.sh replaced by a
stand-in that prints its real summary format. Run by tests/provisioning-teardown.test.ts.

Usage: python check_provision_server.py <path to provision-server.py>
"""
import importlib.util, os, sys, tempfile, types

tmp = tempfile.mkdtemp()
os.environ.update(PROVISION_SECRET="s", PROVISION_LOG_DIR=tmp, PROVISION_STAGING_DIR=tmp, SAAS_ROOT=tmp)
spec = importlib.util.spec_from_file_location("ps", sys.argv[1])
ps = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ps)

seen = []


def fake_destroy(argv, stdout=None, stderr=None, env=None):
    seen.append(argv)
    if argv[2] == "bad-one":
        stdout.write(b"==> destroying client=bad-one\n!! failed to drop database/user moodle_bad_one\n\n"
                     b"  'bad-one' NOT fully destroyed - 2 step(s) failed:\n"
                     b"    - failed to drop database/user moodle_bad_one\n"
                     b"    - certbot delete failed for learn.bad.com\n"
                     b"  Fix the cause and run it again (it is safe to re-run).\n")
        return types.SimpleNamespace(returncode=1)
    stdout.write(b"  destroyed\n")
    return types.SimpleNamespace(returncode=0)


ps.subprocess.run = fake_destroy
fails = 0


def check(name, got, want):
    global fails
    ok = got == want
    fails += not ok
    print(("PASS " if ok else "FAIL ") + name + ("" if ok else f"\n   got:  {got!r}\n   want: {want!r}"))


check("no record yet", ps.teardown_result("acme"), {"state": "none"})

ps.run_destroy("acme", "learn.acme.com")
check("slug + custom domain passed to destroy.sh", seen[-1][2:], ["acme", "learn.acme.com"])
check("done recorded", ps.teardown_result("acme")["state"], "done")
check("no error on success", "error" in ps.teardown_result("acme"), False)

ps.run_destroy("bad-one")
r = ps.teardown_result("bad-one")
check("failed recorded", r["state"], "failed")
check("failure summary extracted", r["error"],
      "failed to drop database/user moodle_bad_one; certbot delete failed for learn.bad.com")

# A later successful run replaces the failure; the log keeps both runs.
ps.subprocess.run = lambda argv, **kw: (kw["stdout"].write(b"  destroyed\n"), types.SimpleNamespace(returncode=0))[1]
ps.run_destroy("bad-one")
check("re-run clears the failure", ps.teardown_result("bad-one")["state"], "done")
with open(os.path.join(tmp, "teardown", "bad-one.log"), encoding="utf-8") as f:
    check("log keeps every run", f.read().count("===== deprovisioning bad-one"), 2)

# While a destroy holds the slug, status says running and a create is refused.
check("claim destroy", ps._claim("acme", "destroy"), None)
check("running while claimed", ps.teardown_result("acme"), {"state": "running"})
check("create refused during destroy", ps._claim("acme", "create"), "destroy")
ps._release("acme")
check("released -> recorded result again", ps.teardown_result("acme")["state"], "done")


def boom():
    raise RuntimeError("x")


ps._claim("zzz", "create")
try:
    ps._claimed("zzz", boom)
except RuntimeError:
    pass
check("lock released after the job raised", ps._claim("zzz", "destroy"), None)

print("ALL PASS" if not fails else f"{fails} FAILED")
sys.exit(1 if fails else 0)
