import { ArrowUpRight } from "lucide-react";
import { marketingGuide } from "@/lib/marketing-guide";

export function MarketingGuide() {
  return (
    <section
      aria-labelledby="marketing-guide-heading"
      className="marketing-guide acquisition-guide"
    >
      <header className="acquisition-guide-header">
        <h2 id="marketing-guide-heading">{marketingGuide.title}</h2>
        <p>{marketingGuide.description}</p>
        <a
          className="acquisition-guide-link"
          href={marketingGuide.documentUrl}
          rel="noopener noreferrer"
          target="_blank"
        >
          {marketingGuide.documentLabel}
          <ArrowUpRight aria-hidden="true" size={17} />
          <span className="sr-only">（在新标签页打开）</span>
        </a>
      </header>

      <ul aria-label="营销能力总览" className="acquisition-capability-grid">
        {marketingGuide.capabilities.map((capability) => (
          <li key={capability.id}>
            <article
              aria-labelledby={`marketing-capability-${capability.id}`}
              className="acquisition-capability-card"
            >
              <h3 id={`marketing-capability-${capability.id}`}>
                {capability.title}
              </h3>
              <p>{capability.description}</p>
            </article>
          </li>
        ))}
      </ul>
    </section>
  );
}
