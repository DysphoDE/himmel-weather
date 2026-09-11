import { Component } from 'react'

/**
 * Hält Fehler aus einzelnen Bausteinen (vor allem Leaflet) davon ab, den ganzen
 * Baum zu unmounten. Ohne das führte ein einziger Kartenfehler zur weißen Seite.
 */
export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) { return { error } }

  componentDidCatch(error, info) {
    console.error('himmel°: Baustein abgestürzt –', error, info?.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    const { fallback } = this.props
    if (!fallback) return null
    return typeof fallback === 'function'
      ? fallback(() => this.setState({ error: null }))
      : fallback
  }
}
