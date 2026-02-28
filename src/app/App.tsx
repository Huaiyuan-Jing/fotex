import { useEffect } from "react";
import { SplitLayout } from "./layout/SplitLayout";
import { useProjectStore } from "../state/useProjectStore";

function App() {
  const loadModels = useProjectStore((s) => s.loadModels);
  const loadTempTex = useProjectStore((s) => s.loadTempTex);

  useEffect(() => {
    loadModels();
    loadTempTex();
  }, [loadModels, loadTempTex]);

  return <SplitLayout />;
}

export default App;
