import { m } from "@/messages";

import { lookupFrom, useLinkTarget } from "../api";
import { describeLink, type LinkOut } from "../link";

/**
 * A link as readable text ("منتج: اسم المنتج"). When the target is known to be hidden from
 * customers (inactive or missing), a note says so: the storefront skips such banners and
 * hides such links, but the backend still lets an admin save them.
 */
export function LinkText({ link }: { link: LinkOut }) {
  const info = useLinkTarget(link);
  return (
    <div className="flex flex-col gap-0.5">
      <span>{describeLink(link, lookupFrom(info))}</span>
      {!info.visible ? (
        <span className="text-xs text-warn">{m.link.hidden}</span>
      ) : null}
    </div>
  );
}
