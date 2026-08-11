/**
 * Statutory pet-trust data for all 50 U.S. states + the District of Columbia.
 *
 * Every U.S. jurisdiction now recognizes a trust for the care of an animal,
 * most of them modeled on Uniform Trust Code (UTC) § 408 or Uniform Probate
 * Code (UPC) § 2-907. The core operating rules are therefore very similar
 * nationwide:
 *   - The trust may be created for an animal alive during the settlor's life.
 *   - It terminates when the last surviving covered animal dies.
 *   - It may be enforced by a person named in the instrument or, if none is
 *     named, by a person appointed by the court.
 *   - Property not required for the animal's care passes to a named remainder
 *     beneficiary, or under statutory default rules if none is named.
 *   - A court may reduce funds it finds substantially exceed the amount
 *     required for the intended use (in most UTC/UPC states).
 *
 * IMPORTANT / DISCLAIMER: Statutes are amended and renumbered. The citations
 * below are provided for general educational reference only, are not guaranteed
 * to be current, and are NOT legal advice. Always confirm the operative statute
 * and its current text with a licensed attorney in the relevant jurisdiction
 * before relying on it.
 */

export type StateLawModel = 'UTC-408' | 'UPC-2-907' | 'STANDALONE' | 'HYBRID';

export interface StateLaw {
  /** Two-letter postal abbreviation, used as the primary key. */
  code: string;
  name: string;
  /** Best-known statutory citation for the animal-care trust provision. */
  statuteCitation: string;
  /** The uniform-law lineage the statute follows. */
  model: StateLawModel;
  /** How long the trust may last. */
  durationRule: string;
  /** What happens to funds remaining after the last animal dies, absent a named remainder beneficiary. */
  remainderDefault: string;
  /** Whether a court may reduce funds it finds excessive for the animal's care. */
  courtMayReduceExcessFunds: boolean;
  /** Who may enforce the trust. */
  enforcement: string;
  /** Jurisdiction-specific notes and practice cautions. */
  notes: string;
}

export const STATES: StateLaw[] = [
  {
    code: 'AL', name: 'Alabama', statuteCitation: 'Ala. Code § 19-3B-408', model: 'UTC-408',
    durationRule: 'Terminates on the death of the last surviving covered animal.',
    remainderDefault: 'Passes to the settlor if living, otherwise to the settlor’s successors in interest.',
    courtMayReduceExcessFunds: true,
    enforcement: 'A person named in the trust, or a person appointed by the court.',
    notes: 'Adopted from Uniform Trust Code § 408.',
  },
  {
    code: 'AK', name: 'Alaska', statuteCitation: 'Alaska Stat. § 13.12.907', model: 'UPC-2-907',
    durationRule: 'Terminates when no living animal is covered by the trust.',
    remainderDefault: 'Transferred to the transferor if living, otherwise under the residuary clause / heirs.',
    courtMayReduceExcessFunds: true,
    enforcement: 'An individual named in the instrument or appointed by the court; standing is broad.',
    notes: 'Follows Uniform Probate Code § 2-907. Alaska is a well-known trust-friendly jurisdiction.',
  },
  {
    code: 'AZ', name: 'Arizona', statuteCitation: 'Ariz. Rev. Stat. § 14-10408', model: 'UTC-408',
    durationRule: 'Terminates on the death of the last surviving covered animal.',
    remainderDefault: 'Passes to the settlor if living, otherwise to the settlor’s successors in interest.',
    courtMayReduceExcessFunds: true,
    enforcement: 'A person named in the trust, or a person appointed by the court.',
    notes: 'Adopted from Uniform Trust Code § 408.',
  },
  {
    code: 'AR', name: 'Arkansas', statuteCitation: 'Ark. Code § 28-73-408', model: 'UTC-408',
    durationRule: 'Terminates on the death of the last surviving covered animal.',
    remainderDefault: 'Passes to the settlor if living, otherwise to the settlor’s successors in interest.',
    courtMayReduceExcessFunds: true,
    enforcement: 'A person named in the trust, or a person appointed by the court.',
    notes: 'Adopted from Uniform Trust Code § 408.',
  },
  {
    code: 'CA', name: 'California', statuteCitation: 'Cal. Prob. Code § 15212', model: 'STANDALONE',
    durationRule: 'Continues for the life of the animal, or the last surviving animal named in the trust.',
    remainderDefault: 'As directed in the instrument; if silent, to the settlor’s heirs. Governed by California-specific rules.',
    courtMayReduceExcessFunds: true,
    enforcement: 'Enforceable by a person named in the instrument, a person appointed by the court, or a nonprofit charitable organization with an interest in animal welfare. Detailed accounting/inspection rights.',
    notes: 'California has a robust standalone statute with strong enforcement and accounting provisions, including standing for animal-welfare organizations.',
  },
  {
    code: 'CO', name: 'Colorado', statuteCitation: 'Colo. Rev. Stat. § 15-5-408', model: 'UTC-408',
    durationRule: 'Terminates on the death of the last surviving covered animal.',
    remainderDefault: 'Passes to the settlor if living, otherwise to the settlor’s successors in interest.',
    courtMayReduceExcessFunds: true,
    enforcement: 'A person named in the trust, or a person appointed by the court.',
    notes: 'Colorado Uniform Trust Code § 408. Colorado also allows long-duration/perpetual trusts generally.',
  },
  {
    code: 'CT', name: 'Connecticut', statuteCitation: 'Conn. Gen. Stat. § 45a-489a', model: 'STANDALONE',
    durationRule: 'Terminates on the death of the last surviving covered animal.',
    remainderDefault: 'As directed in the instrument; otherwise to the settlor’s estate.',
    courtMayReduceExcessFunds: true,
    enforcement: 'A person named in the instrument or appointed by the court.',
    notes: 'Connecticut standalone animal-trust statute.',
  },
  {
    code: 'DE', name: 'Delaware', statuteCitation: 'Del. Code tit. 12, § 3555', model: 'STANDALONE',
    durationRule: 'Terminates on the death of the last surviving covered animal.',
    remainderDefault: 'As directed in the instrument; otherwise to the settlor’s successors in interest.',
    courtMayReduceExcessFunds: false,
    enforcement: 'A person named in the instrument or appointed by the court.',
    notes: 'Delaware is a leading trust jurisdiction; its statute is intentionally settlor-friendly and does not authorize courts to reduce funds as excessive.',
  },
  {
    code: 'DC', name: 'District of Columbia', statuteCitation: 'D.C. Code § 19-1304.08', model: 'UTC-408',
    durationRule: 'Terminates on the death of the last surviving covered animal.',
    remainderDefault: 'Passes to the settlor if living, otherwise to the settlor’s successors in interest.',
    courtMayReduceExcessFunds: true,
    enforcement: 'A person named in the trust, or a person appointed by the court.',
    notes: 'D.C. Uniform Trust Code § 408.',
  },
  {
    code: 'FL', name: 'Florida', statuteCitation: 'Fla. Stat. § 736.0408', model: 'UTC-408',
    durationRule: 'Terminates on the death of the last surviving covered animal.',
    remainderDefault: 'Passes to the settlor if living, otherwise to the settlor’s successors in interest.',
    courtMayReduceExcessFunds: true,
    enforcement: 'A person named in the trust, or a person appointed by the court.',
    notes: 'Florida Trust Code § 736.0408.',
  },
  {
    code: 'GA', name: 'Georgia', statuteCitation: 'O.C.G.A. § 53-12-28', model: 'STANDALONE',
    durationRule: 'May be created for an animal alive during the settlor’s life; continues until the animal dies, or for multiple animals until the death of the last surviving animal.',
    remainderDefault: 'Remaining assets pass as directed in the instrument; if the instrument does not direct, statutory default rules apply.',
    courtMayReduceExcessFunds: true,
    enforcement: 'Enforceable by a person named in the instrument or, if none is named, by a person appointed by the court.',
    notes: 'Georgia expressly permits a trust for the care of an animal alive during the settlor’s lifetime. Naming a remainder beneficiary avoids ambiguity even though defaults exist.',
  },
  {
    code: 'HI', name: 'Hawaii', statuteCitation: 'Haw. Rev. Stat. § 560:7-501', model: 'STANDALONE',
    durationRule: 'Terminates on the death of the last surviving covered animal (statutory cap historically referenced 21 years for some purposes).',
    remainderDefault: 'As directed in the instrument; otherwise to the settlor’s successors in interest.',
    courtMayReduceExcessFunds: true,
    enforcement: 'A person named in the instrument or appointed by the court.',
    notes: 'Hawaii standalone animal-trust statute within its trust code.',
  },
  {
    code: 'ID', name: 'Idaho', statuteCitation: 'Idaho Code § 15-7-601', model: 'STANDALONE',
    durationRule: 'Terminates on the death of the last surviving covered animal.',
    remainderDefault: 'As directed in the instrument; otherwise to the settlor’s successors in interest.',
    courtMayReduceExcessFunds: true,
    enforcement: 'A person named in the instrument or appointed by the court.',
    notes: 'Idaho pet-trust provision.',
  },
  {
    code: 'IL', name: 'Illinois', statuteCitation: '760 ILCS 3/408 (Illinois Trust Code)', model: 'UTC-408',
    durationRule: 'Terminates on the death of the last surviving covered animal.',
    remainderDefault: 'Passes to the settlor if living, otherwise to the settlor’s successors in interest.',
    courtMayReduceExcessFunds: true,
    enforcement: 'A person named in the trust, or a person appointed by the court.',
    notes: 'Now codified in the Illinois Trust Code (effective 2020); formerly 760 ILCS 5/15.2.',
  },
  {
    code: 'IN', name: 'Indiana', statuteCitation: 'Ind. Code § 30-4-2-18', model: 'STANDALONE',
    durationRule: 'Terminates on the death of the last surviving covered animal.',
    remainderDefault: 'As directed in the instrument; otherwise to the settlor’s successors in interest.',
    courtMayReduceExcessFunds: true,
    enforcement: 'A person named in the instrument or appointed by the court.',
    notes: 'Indiana pet-trust statute.',
  },
  {
    code: 'IA', name: 'Iowa', statuteCitation: 'Iowa Code § 633A.2105', model: 'STANDALONE',
    durationRule: 'Terminates on the death of the last surviving covered animal.',
    remainderDefault: 'As directed in the instrument; otherwise to the settlor’s successors in interest.',
    courtMayReduceExcessFunds: true,
    enforcement: 'A person named in the instrument or appointed by the court.',
    notes: 'Iowa Trust Code animal-care provision.',
  },
  {
    code: 'KS', name: 'Kansas', statuteCitation: 'Kan. Stat. § 58a-408', model: 'UTC-408',
    durationRule: 'Terminates on the death of the last surviving covered animal.',
    remainderDefault: 'Passes to the settlor if living, otherwise to the settlor’s successors in interest.',
    courtMayReduceExcessFunds: true,
    enforcement: 'A person named in the trust, or a person appointed by the court.',
    notes: 'Kansas Uniform Trust Code § 408.',
  },
  {
    code: 'KY', name: 'Kentucky', statuteCitation: 'Ky. Rev. Stat. § 386B.4-080', model: 'UTC-408',
    durationRule: 'Terminates on the death of the last surviving covered animal.',
    remainderDefault: 'Passes to the settlor if living, otherwise to the settlor’s successors in interest.',
    courtMayReduceExcessFunds: true,
    enforcement: 'A person named in the trust, or a person appointed by the court.',
    notes: 'Kentucky Uniform Trust Code § 408.',
  },
  {
    code: 'LA', name: 'Louisiana', statuteCitation: 'No dedicated pet-trust statute (civil-law jurisdiction)',
    model: 'STANDALONE',
    durationRule: 'Louisiana has not adopted the UTC/UPC animal-trust provisions; care is typically arranged through conditional legacies, usufruct, or an onerous donation to a caregiver.',
    remainderDefault: 'Governed by Louisiana Civil Code succession and trust rules, not a pet-trust statute.',
    courtMayReduceExcessFunds: false,
    enforcement: 'No statutory animal-trust enforcer; rely on obligations imposed on a legatee/donee and general Trust Code where applicable.',
    notes: 'IMPORTANT: Louisiana is a civil-law state without a dedicated pet-trust statute. A traditional common-law pet trust may not be effective. Consult a Louisiana attorney about conditional legacies and the Louisiana Trust Code.',
  },
  {
    code: 'ME', name: 'Maine', statuteCitation: 'Me. Rev. Stat. tit. 18-B, § 408', model: 'UTC-408',
    durationRule: 'Terminates on the death of the last surviving covered animal.',
    remainderDefault: 'Passes to the settlor if living, otherwise to the settlor’s successors in interest.',
    courtMayReduceExcessFunds: true,
    enforcement: 'A person named in the trust, or a person appointed by the court.',
    notes: 'Maine Uniform Trust Code § 408.',
  },
  {
    code: 'MD', name: 'Maryland', statuteCitation: 'Md. Code, Est. & Trusts § 14.5-407', model: 'UTC-408',
    durationRule: 'Terminates on the death of the last surviving covered animal.',
    remainderDefault: 'Passes to the settlor if living, otherwise to the settlor’s successors in interest.',
    courtMayReduceExcessFunds: true,
    enforcement: 'A person named in the trust, or a person appointed by the court.',
    notes: 'Maryland Trust Act animal-care provision.',
  },
  {
    code: 'MA', name: 'Massachusetts', statuteCitation: 'Mass. Gen. Laws ch. 203E, § 408', model: 'UTC-408',
    durationRule: 'Terminates on the death of the last surviving covered animal.',
    remainderDefault: 'Passes to the settlor if living, otherwise to the settlor’s successors in interest.',
    courtMayReduceExcessFunds: true,
    enforcement: 'A person named in the trust, or a person appointed by the court.',
    notes: 'Massachusetts Uniform Trust Code § 408 (enacted 2012).',
  },
  {
    code: 'MI', name: 'Michigan', statuteCitation: 'Mich. Comp. Laws § 700.2722', model: 'STANDALONE',
    durationRule: 'Terminates on the death of the last surviving covered animal.',
    remainderDefault: 'As directed in the instrument; otherwise to the settlor’s successors in interest.',
    courtMayReduceExcessFunds: true,
    enforcement: 'A person named in the instrument or appointed by the court.',
    notes: 'Michigan Estates and Protected Individuals Code (EPIC) animal-care provision; see also MCL 700.7408.',
  },
  {
    code: 'MN', name: 'Minnesota', statuteCitation: 'Minn. Stat. § 501C.0408', model: 'UTC-408',
    durationRule: 'Terminates on the death of the last surviving covered animal.',
    remainderDefault: 'Passes to the settlor if living, otherwise to the settlor’s successors in interest.',
    courtMayReduceExcessFunds: true,
    enforcement: 'A person named in the trust, or a person appointed by the court.',
    notes: 'Minnesota Trust Code § 408.',
  },
  {
    code: 'MS', name: 'Mississippi', statuteCitation: 'Miss. Code § 91-8-408', model: 'UTC-408',
    durationRule: 'Terminates on the death of the last surviving covered animal.',
    remainderDefault: 'Passes to the settlor if living, otherwise to the settlor’s successors in interest.',
    courtMayReduceExcessFunds: true,
    enforcement: 'A person named in the trust, or a person appointed by the court.',
    notes: 'Mississippi Uniform Trust Code § 408.',
  },
  {
    code: 'MO', name: 'Missouri', statuteCitation: 'Mo. Rev. Stat. § 456.4-408', model: 'UTC-408',
    durationRule: 'Terminates on the death of the last surviving covered animal.',
    remainderDefault: 'Passes to the settlor if living, otherwise to the settlor’s successors in interest.',
    courtMayReduceExcessFunds: true,
    enforcement: 'A person named in the trust, or a person appointed by the court.',
    notes: 'Missouri Uniform Trust Code § 408.',
  },
  {
    code: 'MT', name: 'Montana', statuteCitation: 'Mont. Code § 72-38-408', model: 'UTC-408',
    durationRule: 'Terminates on the death of the last surviving covered animal.',
    remainderDefault: 'Passes to the settlor if living, otherwise to the settlor’s successors in interest.',
    courtMayReduceExcessFunds: true,
    enforcement: 'A person named in the trust, or a person appointed by the court.',
    notes: 'Montana Uniform Trust Code § 408.',
  },
  {
    code: 'NE', name: 'Nebraska', statuteCitation: 'Neb. Rev. Stat. § 30-3834', model: 'UTC-408',
    durationRule: 'Terminates on the death of the last surviving covered animal.',
    remainderDefault: 'Passes to the settlor if living, otherwise to the settlor’s successors in interest.',
    courtMayReduceExcessFunds: true,
    enforcement: 'A person named in the trust, or a person appointed by the court.',
    notes: 'Nebraska Uniform Trust Code § 408.',
  },
  {
    code: 'NV', name: 'Nevada', statuteCitation: 'Nev. Rev. Stat. § 163.0075', model: 'STANDALONE',
    durationRule: 'May be enforced for the care of one or more animals alive at the settlor’s death; terminates when no covered animal is living.',
    remainderDefault: 'As directed in the instrument; otherwise to the settlor’s successors in interest.',
    courtMayReduceExcessFunds: false,
    enforcement: 'A person named in the instrument or appointed by the court.',
    notes: 'Nevada is a trust-friendly jurisdiction; statute does not authorize a court to reduce funds as excessive.',
  },
  {
    code: 'NH', name: 'New Hampshire', statuteCitation: 'N.H. Rev. Stat. § 564-B:4-408', model: 'UTC-408',
    durationRule: 'Terminates on the death of the last surviving covered animal.',
    remainderDefault: 'Passes to the settlor if living, otherwise to the settlor’s successors in interest.',
    courtMayReduceExcessFunds: true,
    enforcement: 'A person named in the trust, or a person appointed by the court.',
    notes: 'New Hampshire Uniform Trust Code § 408.',
  },
  {
    code: 'NJ', name: 'New Jersey', statuteCitation: 'N.J. Stat. § 3B:11-38', model: 'STANDALONE',
    durationRule: 'Terminates on the death of the animal, or the last surviving animal, covered by the trust.',
    remainderDefault: 'As directed in the instrument; otherwise to the settlor’s estate/heirs.',
    courtMayReduceExcessFunds: true,
    enforcement: 'A person named in the instrument or appointed by the court.',
    notes: 'New Jersey standalone animal-trust statute.',
  },
  {
    code: 'NM', name: 'New Mexico', statuteCitation: 'N.M. Stat. § 46A-4-408', model: 'UTC-408',
    durationRule: 'Terminates on the death of the last surviving covered animal.',
    remainderDefault: 'Passes to the settlor if living, otherwise to the settlor’s successors in interest.',
    courtMayReduceExcessFunds: true,
    enforcement: 'A person named in the trust, or a person appointed by the court.',
    notes: 'New Mexico Uniform Trust Code § 408.',
  },
  {
    code: 'NY', name: 'New York', statuteCitation: 'N.Y. Est. Powers & Trusts Law § 7-8.1', model: 'STANDALONE',
    durationRule: 'Terminates when no living animal is covered by the trust.',
    remainderDefault: 'As directed in the instrument; otherwise to the settlor or the settlor’s estate.',
    courtMayReduceExcessFunds: true,
    enforcement: 'A person named in the instrument or appointed by the court; the court may reduce amounts substantially in excess of what is required.',
    notes: 'New York EPTL § 7-8.1 is a well-developed standalone statute.',
  },
  {
    code: 'NC', name: 'North Carolina', statuteCitation: 'N.C. Gen. Stat. § 36C-4-408', model: 'UTC-408',
    durationRule: 'Terminates on the death of the last surviving covered animal.',
    remainderDefault: 'Passes to the settlor if living, otherwise to the settlor’s successors in interest.',
    courtMayReduceExcessFunds: true,
    enforcement: 'A person named in the trust, or a person appointed by the court.',
    notes: 'North Carolina Uniform Trust Code § 408.',
  },
  {
    code: 'ND', name: 'North Dakota', statuteCitation: 'N.D. Cent. Code § 59-12-08', model: 'UTC-408',
    durationRule: 'Terminates on the death of the last surviving covered animal.',
    remainderDefault: 'Passes to the settlor if living, otherwise to the settlor’s successors in interest.',
    courtMayReduceExcessFunds: true,
    enforcement: 'A person named in the trust, or a person appointed by the court.',
    notes: 'North Dakota Uniform Trust Code § 408 (Chapter 59-12).',
  },
  {
    code: 'OH', name: 'Ohio', statuteCitation: 'Ohio Rev. Code § 5804.08', model: 'UTC-408',
    durationRule: 'Terminates on the death of the last surviving covered animal.',
    remainderDefault: 'Passes to the settlor if living, otherwise to the settlor’s successors in interest.',
    courtMayReduceExcessFunds: true,
    enforcement: 'A person named in the trust, or a person appointed by the court.',
    notes: 'Ohio Trust Code § 5804.08.',
  },
  {
    code: 'OK', name: 'Oklahoma', statuteCitation: 'Okla. Stat. tit. 60, § 199', model: 'STANDALONE',
    durationRule: 'Terminates on the death of the last surviving covered animal.',
    remainderDefault: 'As directed in the instrument; otherwise to the settlor’s successors in interest.',
    courtMayReduceExcessFunds: true,
    enforcement: 'A person named in the instrument or appointed by the court.',
    notes: 'Oklahoma Pet Trust Act.',
  },
  {
    code: 'OR', name: 'Oregon', statuteCitation: 'Or. Rev. Stat. § 130.185', model: 'UTC-408',
    durationRule: 'Terminates on the death of the last surviving covered animal.',
    remainderDefault: 'Passes to the settlor if living, otherwise to the settlor’s successors in interest.',
    courtMayReduceExcessFunds: true,
    enforcement: 'A person named in the trust, or a person appointed by the court.',
    notes: 'Oregon Uniform Trust Code § 408 (ORS 130.185).',
  },
  {
    code: 'PA', name: 'Pennsylvania', statuteCitation: '20 Pa. Cons. Stat. § 7738', model: 'UTC-408',
    durationRule: 'Terminates on the death of the last surviving covered animal.',
    remainderDefault: 'Passes to the settlor if living, otherwise to the settlor’s successors in interest.',
    courtMayReduceExcessFunds: true,
    enforcement: 'A person named in the trust, or a person appointed by the court.',
    notes: 'Pennsylvania Uniform Trust Act § 7738.',
  },
  {
    code: 'RI', name: 'Rhode Island', statuteCitation: 'R.I. Gen. Laws § 4-23-1 et seq.', model: 'STANDALONE',
    durationRule: 'Terminates on the death of the last surviving covered animal.',
    remainderDefault: 'As directed in the instrument; otherwise to the settlor’s successors in interest.',
    courtMayReduceExcessFunds: true,
    enforcement: 'A person named in the instrument or appointed by the court.',
    notes: 'Rhode Island animal-trust statute.',
  },
  {
    code: 'SC', name: 'South Carolina', statuteCitation: 'S.C. Code § 62-7-408', model: 'UTC-408',
    durationRule: 'Terminates on the death of the last surviving covered animal.',
    remainderDefault: 'Passes to the settlor if living, otherwise to the settlor’s successors in interest.',
    courtMayReduceExcessFunds: true,
    enforcement: 'A person named in the trust, or a person appointed by the court.',
    notes: 'South Carolina Trust Code § 62-7-408.',
  },
  {
    code: 'SD', name: 'South Dakota', statuteCitation: 'S.D. Codified Laws § 55-1-21', model: 'STANDALONE',
    durationRule: 'Terminates on the death of the last surviving covered animal.',
    remainderDefault: 'As directed in the instrument; otherwise to the settlor’s successors in interest.',
    courtMayReduceExcessFunds: false,
    enforcement: 'A person named in the instrument or appointed by the court.',
    notes: 'South Dakota is a leading trust jurisdiction (no rule against perpetuities); settlor-friendly animal-trust provisions.',
  },
  {
    code: 'TN', name: 'Tennessee', statuteCitation: 'Tenn. Code § 35-15-408', model: 'UTC-408',
    durationRule: 'Terminates on the death of the last surviving covered animal.',
    remainderDefault: 'Passes to the settlor if living, otherwise to the settlor’s successors in interest.',
    courtMayReduceExcessFunds: true,
    enforcement: 'A person named in the trust, or a person appointed by the court.',
    notes: 'Tennessee Uniform Trust Code § 408. Tennessee permits long-duration trusts.',
  },
  {
    code: 'TX', name: 'Texas', statuteCitation: 'Tex. Prop. Code § 112.037', model: 'UTC-408',
    durationRule: 'Terminates on the death of the last surviving covered animal.',
    remainderDefault: 'Passes to the settlor if living, otherwise to the settlor’s successors in interest.',
    courtMayReduceExcessFunds: true,
    enforcement: 'A person named in the trust, or a person appointed by the court.',
    notes: 'Texas Trust Code § 112.037 (based on UTC § 408).',
  },
  {
    code: 'UT', name: 'Utah', statuteCitation: 'Utah Code § 75-2-1001', model: 'HYBRID',
    durationRule: 'Terminates on the death of the last surviving covered animal.',
    remainderDefault: 'As directed in the instrument; otherwise to the settlor’s successors in interest.',
    courtMayReduceExcessFunds: true,
    enforcement: 'A person named in the instrument or appointed by the court.',
    notes: 'Utah has an animal-trust provision in its probate code (see also Utah Code § 75-7-408 in the trust code).',
  },
  {
    code: 'VT', name: 'Vermont', statuteCitation: 'Vt. Stat. tit. 14A, § 408', model: 'UTC-408',
    durationRule: 'Terminates on the death of the last surviving covered animal.',
    remainderDefault: 'Passes to the settlor if living, otherwise to the settlor’s successors in interest.',
    courtMayReduceExcessFunds: true,
    enforcement: 'A person named in the trust, or a person appointed by the court.',
    notes: 'Vermont Uniform Trust Code § 408.',
  },
  {
    code: 'VA', name: 'Virginia', statuteCitation: 'Va. Code § 64.2-726', model: 'UTC-408',
    durationRule: 'Terminates on the death of the last surviving covered animal.',
    remainderDefault: 'Passes to the settlor if living, otherwise to the settlor’s successors in interest.',
    courtMayReduceExcessFunds: true,
    enforcement: 'A person named in the trust, or a person appointed by the court.',
    notes: 'Virginia Uniform Trust Code § 408 (§ 64.2-726).',
  },
  {
    code: 'WA', name: 'Washington', statuteCitation: 'Wash. Rev. Code § 11.118.005 et seq.', model: 'STANDALONE',
    durationRule: 'Terminates on the death of the last surviving covered animal.',
    remainderDefault: 'As directed in the instrument; otherwise to the settlor’s successors in interest.',
    courtMayReduceExcessFunds: true,
    enforcement: 'A person named in the instrument or appointed by the court.',
    notes: 'Washington Trusts for Care of Animals Act (ch. 11.118 RCW).',
  },
  {
    code: 'WV', name: 'West Virginia', statuteCitation: 'W. Va. Code § 44D-4-408', model: 'UTC-408',
    durationRule: 'Terminates on the death of the last surviving covered animal.',
    remainderDefault: 'Passes to the settlor if living, otherwise to the settlor’s successors in interest.',
    courtMayReduceExcessFunds: true,
    enforcement: 'A person named in the trust, or a person appointed by the court.',
    notes: 'West Virginia Uniform Trust Code § 408.',
  },
  {
    code: 'WI', name: 'Wisconsin', statuteCitation: 'Wis. Stat. § 701.0408', model: 'UTC-408',
    durationRule: 'Terminates on the death of the last surviving covered animal.',
    remainderDefault: 'Passes to the settlor if living, otherwise to the settlor’s successors in interest.',
    courtMayReduceExcessFunds: true,
    enforcement: 'A person named in the trust, or a person appointed by the court.',
    notes: 'Wisconsin Trust Code § 701.0408.',
  },
  {
    code: 'WY', name: 'Wyoming', statuteCitation: 'Wyo. Stat. § 4-10-409', model: 'UTC-408',
    durationRule: 'Terminates on the death of the last surviving covered animal.',
    remainderDefault: 'Passes to the settlor if living, otherwise to the settlor’s successors in interest.',
    courtMayReduceExcessFunds: true,
    enforcement: 'A person named in the trust, or a person appointed by the court.',
    notes: 'Wyoming Uniform Trust Code § 409. Wyoming is a trust-friendly, no-income-tax jurisdiction.',
  },
];

export const STATE_BY_CODE: Record<string, StateLaw> = Object.fromEntries(
  STATES.map((s) => [s.code, s]),
);

export function getStateLaw(code: string): StateLaw | undefined {
  return STATE_BY_CODE[code.toUpperCase()];
}

export const LEGAL_DISCLAIMER =
  'This document is NOT legal advice and should not be construed as such. ' +
  'PetGuardian is not a law firm. This is a working guide intended to help you ' +
  'and a licensed attorney in your state draft and execute official documents — ' +
  'it is not itself a final legal instrument. Please review it with legal counsel ' +
  'before signing, funding, or relying on it. Statutory citations may be amended ' +
  'or renumbered and are not guaranteed current.';

/** Short version for page footers. */
export const LEGAL_DISCLAIMER_SHORT =
  'Not legal advice — a guide for your attorney to draft official documents. Review with counsel before signing.';
