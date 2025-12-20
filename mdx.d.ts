declare module "*.mdx" {
  import type { MDXContentProps } from "mdx/types";
  const MDXComponent: (props: MDXContentProps) => JSX.Element;
  export default MDXComponent;
}
