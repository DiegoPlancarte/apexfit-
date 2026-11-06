/**
 * Decoupled Content Area Component
 *
 * Provides a clean semantic main viewport container for the active view.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - Active view component
 */
export const Content = ({ children }) => {
  return <main className="content-area">{children}</main>;
};

export default Content;
