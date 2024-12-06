import * as React from 'react';
import NativeMap from "./features/native/NativeMap";

export const App = () => {
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto">
        <NativeMap />
      </div>
    </div>
  );
}

export default App;
