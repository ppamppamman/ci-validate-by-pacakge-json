import { useRef } from "react";

function App() {
  const throttleGetFunc = useRef();
  const versionInfo = useRef("0.0.4");
  const END_POINT = "http://127.0.0.1:8080/version.json";
  const fetchVersion = async () => {
    const response = await fetch(END_POINT);
    const result = await response.json();
    return result;
  };

  throttleGetFunc.current = setInterval(async () => {
    const fetchedVersion = await fetchVersion();
    console.log(fetchedVersion.version, versionInfo.current);
    if (fetchedVersion.version !== versionInfo.current) {
      alert("version changed!");
      clearInterval(throttleGetFunc.current);
    }
  }, 10000);

  return <div className="App">here is the test app</div>;
}

export default App;
