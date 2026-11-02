/**
 * features/banners (البانرات): home-screen banners and the link-target model they share with
 * notification campaigns.
 *
 * The real model (see README): a flat, ordered list (no paging); each banner has a mandatory
 * image, title, optional subtitle, a link `{type, value}`, an active switch and an optional
 * UTC window. Link types are the backend's catalog types: none, product / category / brand
 * (value = slug), new, sale, and an https url. Order is changed with one call that carries
 * every id; there is no numeric sort field to edit.
 */
export {
  lookupFrom,
  useBanners,
  useDeleteBanner,
  useLinkTarget,
  useReorderBanners,
  useUpdateBanner,
  type Banner,
} from "./api";
export { BannerDialog } from "./components/banner-dialog";
export { BannersTable } from "./components/banners-table";
export { LinkTargetField } from "./components/link-target-field";
export { LinkText } from "./components/link-text";
export {
  EMPTY_LINK,
  LINK_TYPES,
  URL_MAX,
  changeLinkType,
  describeLink,
  fromBackendLink,
  isLinkType,
  takesValue,
  toBackendLink,
  validateLink,
  type LinkOut,
  type LinkType,
  type LinkValue,
} from "./link";
