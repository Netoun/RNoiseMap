import { styled } from "@stitches/react";
import NativeMap from "./features/native/NativeMap";

const Wrapper = styled("main", {
  height: "100%",
});

function App() {
  return (
    <Wrapper>
      <NativeMap />
    </Wrapper>
  );
}

export default App;
