import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";

const eslintConfig = [
  {
    ignores: [".next/**", "out/**", "node_modules/**", "coverage/**", "next-env.d.ts"],
  },
  ...coreWebVitals,
  ...typescript,
  // Last: turn off every rule that would fight Prettier.
  prettier,
];

export default eslintConfig;
