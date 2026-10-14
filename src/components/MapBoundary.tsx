import { Component, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { failed: boolean };

// The map is an enhancement. If it throws while rendering or in an effect,
// only this region is replaced; the list and details keep working.
export class MapBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    console.error('Map failed to load:', error);
  }

  render() {
    if (this.state.failed) {
      return <p>The map is unavailable. The list has all the parks.</p>;
    }
    return this.props.children;
  }
}
