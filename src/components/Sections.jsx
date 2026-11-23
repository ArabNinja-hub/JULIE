import { useState } from 'react'
import {
  Telescope,
  Orbit,
  Sparkles,
  Moon,
  Rocket,
  Star,
  Heart,
  MailOpen,
  Mail,
  Quote,
} from 'lucide-react'
import Reveal from './Reveal'
import {
  ABOUT,
  OBSERVATIONS,
  APPRECIATION,
  SECRET,
  CORNER,
  EXPLORE,
} from '../lib/content'
import { DESTINATIONS, LANDMARKS } from '../lib/destinations'
import { playUiSound } from '../lib/audio'
import {
  Navigation,
  MapPin,
  Compass,
  Footprints,
  Mountain,
  Globe2,
  Info,
} from 'lucide-react'

const ICONS = { Telescope, Orbit, Sparkles, Moon, Rocket, Star }

function SectionHeading({ eyebrow, title, intro }) {
  return (
    <Reveal className="section-heading">
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="section-title">{title}</h2>
      {intro && <p className="section-intro">{intro}</p>}
      <div className="divider" aria-hidden="true">
        <span />
        <Star size={12} strokeWidth={1.5} />
        <span />
      </div>
    </Reveal>
  )
}

/* ---------------- A. A little about Juliet ---------------- */
export function About() {
  return (
    <section className="section" id="about">
      <div className="container">
        <SectionHeading eyebrow={ABOUT.eyebrow} title={ABOUT.title} />
        <div className="about__grid">
          <Reveal className="about__text">
            {ABOUT.paragraphs.map((p, i) => (
              <p key={i} className={i === 0 ? 'about__lead' : ''}>
                {p}
              </p>
            ))}
          </Reveal>
          <Reveal className="about__traits" delay={150}>
            {ABOUT.traits.map((trait) => (
              <span key={trait} className="trait-chip">
                <Heart size={12} strokeWidth={1.5} />
                {trait}
              </span>
            ))}
            <p className="about__note">
              * An incomplete list. The full list is classified, and also
              enormous.
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

/* ---------------- B. Cosmic observations ---------------- */
export function Observations() {
  return (
    <section className="section section--alt" id="observations">
      <div className="container">
        <SectionHeading
          eyebrow={OBSERVATIONS.eyebrow}
          title={OBSERVATIONS.title}
          intro={OBSERVATIONS.intro}
        />
        <div className="obs-grid">
          {OBSERVATIONS.items.map((item, i) => {
            const Icon = ICONS[item.icon] || Star
            return (
              <Reveal key={item.id} delay={(i % 3) * 120}>
                <article className="obs-card">
                  <div className="obs-card__top">
                    <span className="obs-card__icon">
                      <Icon size={20} strokeWidth={1.5} />
                    </span>
                    <span className="obs-card__id">№ {item.id}</span>
                  </div>
                  <h3 className="obs-card__title">{item.title}</h3>
                  <p className="obs-card__text">{item.text}</p>
                </article>
              </Reveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}

/* ---------------- C. A universe of appreciation ---------------- */
export function Appreciation() {
  return (
    <section className="section" id="appreciation">
      <div className="container">
        <SectionHeading
          eyebrow={APPRECIATION.eyebrow}
          title={APPRECIATION.title}
        />
        <div className="app-grid">
          {APPRECIATION.items.map((item, i) => (
            <Reveal key={i} delay={(i % 3) * 120}>
              <figure className="app-card">
                <Quote size={18} strokeWidth={1.5} className="app-card__icon" />
                <blockquote>{item}</blockquote>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}


/* ---------------- Lunar exploration invitation ---------------- */

export function ExplorationIntro({ onExplore, webgl, isMobile }) {
  return (
    <section className="section explore-intro-section" id="explore">
      <div className="container">
        <SectionHeading
          eyebrow={EXPLORE.eyebrow}
          title={EXPLORE.title}
          intro={EXPLORE.intro}
        />

        <Reveal className="explore-cta">
          <div className="explore-cta__visual" aria-hidden="true">
            <div className="explore-cta__grid" />
            <div className="explore-cta__pin explore-cta__pin--a">
              <MapPin size={12} />
            </div>
            <div className="explore-cta__pin explore-cta__pin--b">
              <MapPin size={12} />
            </div>
            <div className="explore-cta__pin explore-cta__pin--c">
              <MapPin size={12} />
            </div>
            <div className="explore-cta__pin explore-cta__pin--d">
              <MapPin size={12} />
            </div>
            <span className="explore-cta__crosshair" />
          </div>

          <div className="explore-cta__body">
            <h3>Four regions. Nine discoveries. One Moon.</h3>
            <p>
              {webgl
                ? 'A real first-person lunar surface — walk into craters, climb crater rims, and log every discovery you find. Nothing here is a static photograph.'
                : 'Your browser cannot render 3D graphics, but the full map, coordinates and science for every region are still below.'}
            </p>

            <ul className="explore-cta__list">
              {DESTINATIONS.map((d) => (
                <li key={d.id}>
                  <span className="explore-cta__dot" />
                  <span className="explore-cta__name">{d.name}</span>
                  <span className="explore-cta__coords">{d.coords}</span>
                </li>
              ))}
            </ul>

            <div className="explore-cta__meta">
              <span>
                <Footprints size={13} /> {LANDMARKS.length} discovery markers
              </span>
              <span>
                <Navigation size={13} />{' '}
                {isMobile ? 'Joystick + drag' : 'WASD + mouse'}
              </span>
              <span>
                <Mountain size={13} /> Procedural terrain
              </span>
            </div>

            {webgl ? (
              <button
                className="btn btn--primary btn--lg"
                onClick={() => {
                  playUiSound('click')
                  onExplore()
                }}
              >
                <Rocket size={17} strokeWidth={1.7} />
                Explore the Moon
              </button>
            ) : (
              <p className="explore-cta__fallback">
                <Info size={14} /> 3D exploration needs WebGL — try a recent
                version of Chrome, Safari, Firefox or Edge.
              </p>
            )}
          </div>
        </Reveal>

        <div className="dest-cards">
          {DESTINATIONS.map((d, i) => (
            <Reveal key={d.id} delay={i * 90}>
              <article className="dest-card">
                <p className="dest-card__index">0{i + 1}</p>
                <h3 className="dest-card__name">{d.name}</h3>
                <p className="dest-card__latin">{d.latin}</p>
                <p className="dest-card__coords">
                  <Globe2 size={12} /> {d.coords}
                </p>
                <p className="dest-card__desc">{d.description}</p>
                <ul className="dest-card__facts">
                  {d.facts.slice(0, 2).map((f) => (
                    <li key={f}>
                      <Telescope size={12} /> {f}
                    </li>
                  ))}
                </ul>
                {webgl && (
                  <button
                    className="dest-card__go"
                    onClick={() => {
                      playUiSound('click')
                      onExplore(d.id)
                    }}
                  >
                    <Compass size={14} /> Walk here
                  </button>
                )}
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ---------------- A little corner of the universe ---------------- */

export function CornerSection() {
  return (
    <section className="section section--alt corner" id="corner">
      <div className="container">
        <SectionHeading eyebrow={CORNER.eyebrow} title={CORNER.title} />
        <div className="corner__grid">
          <Reveal className="corner__text">
            {CORNER.paragraphs.map((p, i) => (
              <p key={i} className={i === 0 ? 'about__lead' : ''}>
                {p}
              </p>
            ))}
          </Reveal>
          <Reveal className="corner__aside" delay={140}>
            <div className="corner__card">
              <Sparkles size={20} strokeWidth={1.4} />
              <p>{CORNER.messageLabel}</p>
              <a href="#secret" className="corner__link">
                Follow it <span aria-hidden="true">→</span>
              </a>
            </div>
          </Reveal>
        </div>

        <SecretMessage />
      </div>
    </section>
  )
}

/* ---------------- D. A secret message ---------------- */
export function SecretMessage() {
  const [open, setOpen] = useState(false)

  return (
    <div className="secret-block" id="secret">
      <div className="container">
        <SectionHeading eyebrow={SECRET.eyebrow} title={SECRET.title} />

        <Reveal className="secret">
          <button
            className={`secret__button ${open ? 'secret__button--open' : ''}`}
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
          >
            {open ? (
              <MailOpen size={18} strokeWidth={1.5} />
            ) : (
              <Mail size={18} strokeWidth={1.5} />
            )}
            {open ? SECRET.buttonLabelOpen : SECRET.buttonLabel}
          </button>

          <div className={`secret__letter ${open ? 'secret__letter--open' : ''}`}>
            <div className="secret__letter-inner">
              <p className="secret__letter-title">{SECRET.messageTitle}</p>
              {SECRET.messageBody.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
              <p className="secret__signoff">{SECRET.signoff}</p>
            </div>
          </div>
        </Reveal>
      </div>
    </div>
  )
}

/* ---------------- Footer ---------------- */
export function Footer() {
  return (
    <footer className="footer">
      <div className="container footer__inner">
        <p className="footer__brand">
          <Moon size={14} strokeWidth={1.5} />
          JULIET
        </p>
        <p className="footer__note">
          Made among the stars. No moons were disturbed in the making of
          this website.
        </p>
      </div>
    </footer>
  )
}
