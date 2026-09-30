"use client";

import { CheckCircle, CircleDashed, Clock, Sparkle } from "@phosphor-icons/react/dist/ssr";
import { useState } from "react";
import { proPricing, roadmap, type RoadmapStage, type RoadmapStageId } from "../lib/roadmap";

function PriceBox({ stage }: { stage: RoadmapStage }) {
  if (stage.id === "v1") {
    return (
      <div className="roadmap-price">
        <small>Şu an</small>
        <div><strong>Ücretsiz</strong></div>
        <p>Geliştirme aşamasında hiçbir ücret alınmaz.</p>
      </div>
    );
  }
  if (stage.id === "v2") {
    return (
      <div className="roadmap-prices">
        <div className="roadmap-price">
          <small>Free · her zaman</small>
          <div><strong>0 $</strong></div>
          <p>Free hesap kalıcıdır; Pro geldiğinde de ücretsiz kullanmaya devam edersin.</p>
        </div>
        <div className="roadmap-price featured">
          <small><Sparkle aria-hidden size={14} weight="fill" />Pro · gelişim indirimi</small>
          <div>
            <s aria-label={`Normal fiyat ${proPricing.regular}`}>{proPricing.regular}</s>
            <strong>{proPricing.launch}</strong>
            <span>/ {proPricing.period}</span>
          </div>
          <p>Sabit fiyat. Ürün tam sürüme ulaşıp yeterli kullanıcıya ulaştığında {proPricing.regular} olacak.</p>
        </div>
      </div>
    );
  }
  if (stage.id === "v3plus") {
    return (
      <div className="roadmap-price">
        <small>Kurumsal</small>
        <div><strong>V3 sonrası</strong></div>
        <p>Kurumsal kullanım ve fiyatlandırma V3’ten sonra netleşecek.</p>
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
  const [active, setActive] = useState<RoadmapStageId>("v1");
  const stage = roadmap.find((item) => item.id === active) ?? roadmap[0]!;
  const shipped = stage.status === "now";
  return (
    <section aria-labelledby="roadmap-title" className="roadmap" id="gelisim-plani">
      <div>
        <h2 className="section-title" id="roadmap-title">Gelişim planı</h2>
        <p className="muted">Bir aşamaya dokun; o aşamada gelecek özellik ve olanakları gör.</p>
      </div>
      <div aria-label="Gelişim aşamaları" className="roadmap-stages" role="group">
        {roadmap.map((item) => (
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
      <p className="muted small">Plan yön göstermek içindir; kapsam ve sıralama kullanıcı geri bildirimlerine göre değişebilir.</p>
    </section>
  );
}
