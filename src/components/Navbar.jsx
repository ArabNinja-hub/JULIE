import { useEffect, useState } from 'react'
import { Moon, Menu, X, Rocket } from 'lucide-react'

const LINKS = [
  { href: '#explore', label: 'Explore' },
  { href: '#about', label: 'About' },
  { href: '#journey', label: 'Journey' },
  { href: '#observations', label: 'Observations' },
  { href: '#appreciation', label: 'Appreciation' },
  { href: '#secret', label: 'Secret' },
]

export default function Navbar({ onExplore }) {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header className={`nav ${scrolled ? 'nav--scrolled' : ''}`}>
      <div className="nav__inner container">
        <a href="#top" className="nav__brand" onClick={() => setOpen(false)}>
          <Moon size={18} strokeWidth={1.5} />
          <span>JULIET</span>
        </a>

        <nav className={`nav__links ${open ? 'nav__links--open' : ''}`}>
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="nav__link"
              onClick={() => setOpen(false)}
            >
              {link.label}
            </a>
          ))}
        </nav>

        <button
          className="nav__launch"
          onClick={() => {
            setOpen(false)
            onExplore()
          }}
          aria-label="Explore the Moon"
        >
          <Rocket size={14} strokeWidth={1.7} />
          <span>Explore</span>
        </button>

        <button
          className="nav__toggle"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
    </header>
  )
}
