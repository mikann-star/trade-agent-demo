import { ArrowUpRight } from "lucide-react";
import { acquisitionGuide } from "@/lib/acquisition-guide";

export function AcquisitionGuide() {
  return (
    <section
      aria-labelledby="acquisition-guide-heading"
      className="acquisition-guide"
    >
      <header className="acquisition-guide-header">
        <h2 id="acquisition-guide-heading">{acquisitionGuide.title}</h2>
        <p>{acquisitionGuide.description}</p>
        <a
          className="acquisition-guide-link"
          href={acquisitionGuide.documentUrl}
          rel="noopener noreferrer"
          target="_blank"
        >
          {acquisitionGuide.documentLabel}
          <ArrowUpRight aria-hidden="true" size={17} />
          <span className="sr-only">（在新标签页打开）</span>
        </a>
      </header>

      <ul aria-label="招商能力总览" className="acquisition-capability-grid">
        {acquisitionGuide.capabilities.map((capability) => (
          <li key={capability.id}>
            <article
              aria-labelledby={`acquisition-capability-${capability.id}`}
              className="acquisition-capability-card"
            >
              <h3 id={`acquisition-capability-${capability.id}`}>
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
