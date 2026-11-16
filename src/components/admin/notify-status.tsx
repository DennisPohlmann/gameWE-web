import { Icon } from "@/components/admin/icons";
import type { TestJob } from "@/lib/admin-notify";
import { localized } from "@/lib/admin-i18n";
import { NOTIFY_T } from "@/lib/admin-texts";
import { fmtDateTime } from "@/lib/format";
import { fill, type Lang } from "@/lib/i18n";
import type { NotifyStatus } from "@/lib/notify-core";

// The outcome of the last message to a target and its last test, whichever
// is newer: waiting, failed (e.g. a collector without notifications), or
// the status the collector wrote.
export function NotifyStatusLine({ status, test, lang }: { status: NotifyStatus; test: TestJob | null; lang: Lang }) {
  const n = localized(NOTIFY_T, lang);
  if (test && (test.status === "pending" || test.status === "running")) {
    return (
      <p className="notify-status wait" role="status">
        <Icon name="clock" />
        <span>{fill(n.testWaiting, { id: String(test.id) })}</span>
      </p>
    );
  }
  if (test && test.status === "failed" && (!status || status.at < test.at)) {
    return (
      <p className="notify-status bad">
        <Icon name="warn" />
        <span dir="auto">{fill(n.testFailed, { id: String(test.id), e: test.result })}</span>
      </p>
    );
  }
  if (!status) return <p className="notify-status">{n.never}</p>;
  const t = fmtDateTime(status.at, lang);
  return status.ok ? (
    <p className="notify-status ok">
      <Icon name="check" />
      <span>{fill(n.lastOk, { t })}</span>
    </p>
  ) : (
    <p className="notify-status bad">
      <Icon name="warn" />
      <span dir="auto">{fill(n.lastError, { t, e: status.error })}</span>
    </p>
  );
}
