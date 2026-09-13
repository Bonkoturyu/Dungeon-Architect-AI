mergeInto(LibraryManager.library, {
  DAI_ReportBenchmarkStatus: function (statusPtr) {
    try {
      var status = UTF8ToString(statusPtr);
      window.__DAI_UNITY_BENCHMARK_STATUS__ = status;
      console.log('DAI_BENCH_STATUS:' + status);
    } catch (error) {
      console.error('DAI benchmark status bridge failed:', error);
    }
  },

  DAI_ReportBenchmarkJson: function (jsonPtr) {
    try {
      var text = UTF8ToString(jsonPtr);
      var parsed = JSON.parse(text);
      window.__DAI_UNITY_BENCHMARK__ = parsed;
      window.__DAI_UNITY_BENCHMARK_READY__ = true;
      console.log('DAI_BENCH_RESULT_READY');
    } catch (error) {
      window.__DAI_UNITY_BENCHMARK__ = {
        complete: true,
        failed: true,
        runtimeErrors: 1,
        bridgeError: String(error)
      };
      window.__DAI_UNITY_BENCHMARK_READY__ = true;
      console.error('DAI benchmark result bridge failed:', error);
    }
  }
});
