import { productName } from "@devcontext/contracts/brand";
import { LogoMark } from "./logo-mark";

/**
 * The product logo: the mark tile plus the name. The tile is decorative
 * (the name follows it), so links read as the product name only. The name
 * comes from the shared brand constants, so a rename is one change.
 */
export function BrandMark() {
  return (
    <>
      <span aria-hidden="true" className="brand-mark"><LogoMark /></span>
      <span>{productName}</span>
    </>
  );
}
