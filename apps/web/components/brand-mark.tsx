import { productMonogram, productName } from "@devcontext/contracts/brand";

/**
 * The product logo: the monogram tile plus the name. The tile is decorative
 * (the name follows it), so links read as the product name only. The text
 * comes from the shared brand constants, so a rename is one change.
 */
export function BrandMark() {
  return (
    <>
      <span aria-hidden="true" className="brand-mark">{productMonogram}</span>
      <span>{productName}</span>
    </>
  );
}
