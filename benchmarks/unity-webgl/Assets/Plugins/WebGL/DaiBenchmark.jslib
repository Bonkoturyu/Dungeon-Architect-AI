mergeInto(LibraryManager.library, {
  DAI_ReportBenchmarkJson: function (jsonPtr) {
    try {
      var text = UTF8ToString(jsonPtr);
      var parsed = JSON.parse(text);
      window.__DAI_UNITY_BENCHMARK__ = parsed;
      window.__DAI_UNITY_BENCHMARK_READY__ = true;
    } catch (error) {
      window.__DAI_UNITY_BENCHMARK__ = {
        complete: false,
        runtimeErrors: 1,
        bridgeError: String(error)
      };
      window.__DAI_UNITY_BENCHMARK_READY__ = true;
    }
  }
});
