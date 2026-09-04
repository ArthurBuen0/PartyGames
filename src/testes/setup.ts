import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Sem `globals: true`, o Testing Library não registra a limpeza sozinho e o DOM
// de um teste vaza para o seguinte.
afterEach(cleanup);
