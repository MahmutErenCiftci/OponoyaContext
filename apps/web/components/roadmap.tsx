"use client";

import { CheckCircle, CircleDashed, Clock, Sparkle } from "@phosphor-icons/react/dist/ssr";
import { useState } from "react";
import { defineCopy } from "../lib/i18n";
import { proPricing, roadmap, type RoadmapStage, type RoadmapStageId } from "../lib/roadmap";
import { useLocale } from "./locale-provider";

const copy = defineCopy({
  tr: {
    now: "Şu an",
    free: "Ücretsiz",
    freeNow: "Geliştirme aşamasında hiçbir ücret alınmaz.",
    freeAlways: "Free · her zaman",
    zeroPrice: "0 $",
    freeAlwaysText: "Free hesap kalıcıdır; Pro geldiğinde de ücretsiz kullanmaya devam edersin.",
    proDiscount: "Pro · gelişim indirimi",
    regularPrice: (price: string) => `Normal fiyat ${price}`,
    fixedPrice: (regular: string) => `Sabit fiyat. Ürün tam sürüme ulaşıp yeterli kullanıcıya ulaştığında ${regular} olacak.`,
    enterprise: "Kurumsal",
    afterV3: "V3 sonrası",
    enterpriseText: "Kurumsal kullanım ve fiyatlandırma V3’ten sonra netleşecek.",
    title: "Gelişim planı",
    lead: "Bir aşamaya dokun; o aşamada gelecek özellik ve olanakları gör.",
    stagesLabel: "Gelişim aşamaları",
    disclaimer: "Plan yön göstermek içindir; kapsam ve sıralama kullanıcı geri bildirimlerine göre değişebilir.",
  },
  en: {
    now: "Now",
    free: "Free",
    freeNow: "Nothing is charged while the product is in development.",
    freeAlways: "Free · always",
    zeroPrice: "$0",
    freeAlwaysText: "The Free account is permanent; you keep using it for free when Pro arrives.",
    proDiscount: "Pro · development discount",
    regularPrice: (price: string) => `Regular price ${price}`,
    fixedPrice: (regular: string) => `Fixed price. It becomes ${regular} once the product is complete and has enough users.`,
    enterprise: "Enterprise",
    afterV3: "After V3",
    enterpriseText: "Enterprise use and pricing will be settled after V3.",
    title: "Development plan",
    lead: "Tap a stage to see the features and options it brings.",
    stagesLabel: "Development stages",
    disclaimer: "The plan shows direction; scope and order may change with user feedback.",
  },
});

function PriceBox({ stage }: { stage: RoadmapStage }) {
  const locale = useLocale();
  const t = copy[locale];
  const pricing = proPricing[locale];
  if (stage.id === "v1") {
    return (
      <div className="roadmap-price">
        <small>{t.now}</small>
        <div><strong>{t.free}</strong></div>
        <p>{t.freeNow}</p>
      </div>
    );
  }
  if (stage.id === "v2") {
    return (
      <div className="roadmap-prices">
        <div className="roadmap-price">
          <small>{t.freeAlways}</small>
          <div><strong>{t.zeroPrice}</strong></div>
          <p>{t.freeAlwaysText}</p>
        </div>
        <div className="roadmap-price featured">
          <small><Sparkle aria-hidden size={14} weight="fill" />{t.proDiscount}</small>
          <div>
            <s aria-label={t.regularPrice(pricing.regular)}>{pricing.regular}</s>
            <strong>{pricing.launch}</strong>
            <span>/ {pricing.period}</span>
          </div>
          <p>{t.fixedPrice(pricing.regular)}</p>
        </div>
      </div>
    );
  }
  if (stage.id === "v3plus") {
    return (
      <div className="roadmap-price">
        <small>{t.enterprise}</small>
        <div><strong>{t.afterV3}</strong></div>
        <p>{t.enterpriseText}</p>
      </div>
    );
  }
  return null;
}

/**
 * Stage buttons (V1, V2, V3, V3+) with the selected stage's features. V1
 * items are shipped; later items are plans and are marked as such.
 */
export function Roadmap() {
  const locale = useLocale();
  const t = copy[locale];
  const stages = roadmap[locale];
  const [active, setActive] = useState<RoadmapStageId>("v1");
  const stage = stages.find((item) => item.id === active) ?? stages[0]!;
  const shipped = stage.status === "now";
  return (
    <section aria-labelledby="roadmap-title" className="roadmap" id="gelisim-plani">
      <div>
        <h2 className="section-title" id="roadmap-title">{t.title}</h2>
        <p className="muted">{t.lead}</p>
      </div>
      <div aria-label={t.stagesLabel} className="roadmap-stages" role="group">
        {stages.map((item) => (
          <button aria-pressed={item.id === active} className={`roadmap-stage ${item.status}`} key={item.id} onClick={() => setActive(item.id)} type="button">
            <span className="roadmap-tag">{item.tag}</span>
            <span className="roadmap-stage-text"><strong>{item.name}</strong><small>{item.statusLabel}</small></span>
          </button>
        ))}
      </div>
      <div aria-live="polite" className={`roadmap-panel ${stage.status}`} key={stage.id}>
        <div className="roadmap-panel-head">
          <div>
            <span className={`roadmap-status ${stage.status}`}>{shipped ? <CheckCircle aria-hidden size={14} weight="fill" /> : <Clock aria-hidden size={14} />}{stage.statusLabel}</span>
            <h3>{stage.tag} · {stage.name}</h3>
            <p>{stage.summary}</p>
          </div>
          <PriceBox stage={stage} />
        </div>
        <div className="roadmap-groups">
          {stage.groups.map((group) => (
            <div className="roadmap-group" key={group.title}>
              <h4>{group.title}</h4>
              <ul>
                {group.items.map((item) => (
                  <li key={item}>{shipped ? <CheckCircle aria-hidden className="done" size={18} weight="fill" /> : <CircleDashed aria-hidden size={18} />}<span>{item}</span></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        {stage.note && <p className="muted small">{stage.note}</p>}
      </div>
      <p className="muted small">{t.disclaimer}</p>
    </section>
  );
}
