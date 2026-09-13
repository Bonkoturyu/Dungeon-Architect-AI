using System;
using System.Collections;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using UnityEngine;

namespace DungeonArchitectAI.Benchmark
{
    public sealed class DaiUnityBenchmarkBootstrap : MonoBehaviour
    {
        private const string FixtureId = "DAI-M1-RENDERER-20-v1";
        private const int RoomColumns = 5;
        private const int RoomRows = 4;
        private const float RoomSize = 8f;
        private const float RoomHeight = 3f;
        private const float WallThickness = 0.2f;
        private const float CorridorWidth = 3f;
        private const float Spacing = 12f;
        private const int EffectiveSamples = 179;

        [SerializeField]
        private Material benchmarkMaterial;

        private readonly List<float> frameSamplesMs = new List<float>(EffectiveSamples);
        private Mesh benchmarkCubeMesh;
        private float startRealtime;
        private float sceneGenerationMs;
        private int runtimeErrors;

        public Material BenchmarkMaterial
        {
            set => benchmarkMaterial = value;
        }

#if UNITY_WEBGL && !UNITY_EDITOR
        [DllImport("__Internal")]
        private static extern void DAI_ReportBenchmarkJson(string json);

        [DllImport("__Internal")]
        private static extern void DAI_ReportBenchmarkStatus(string status);
#endif

        private void Awake()
        {
            try
            {
                ReportStatus("awake");
                startRealtime = Time.realtimeSinceStartup;
                Application.targetFrameRate = -1;
                QualitySettings.vSyncCount = 0;
                Application.logMessageReceived += OnLogMessage;

                if (benchmarkMaterial == null)
                {
                    throw new InvalidOperationException("Serialized benchmark material is missing.");
                }

                benchmarkCubeMesh = CreateCubeMesh();

                var generationStart = Time.realtimeSinceStartup;
                BuildFixture();
                sceneGenerationMs = (Time.realtimeSinceStartup - generationStart) * 1000f;
                ReportStatus("fixture-built");

                StartCoroutine(MeasureFrames());
            }
            catch (Exception error)
            {
                runtimeErrors += 1;
                Debug.LogException(error);
                ReportFailure(error);
            }
        }

        private void OnDestroy()
        {
            Application.logMessageReceived -= OnLogMessage;
            if (benchmarkCubeMesh != null)
            {
                Destroy(benchmarkCubeMesh);
            }
        }

        private void OnLogMessage(string condition, string stackTrace, LogType type)
        {
            if (type == LogType.Error || type == LogType.Exception || type == LogType.Assert)
            {
                runtimeErrors += 1;
            }
        }

        private void BuildFixture()
        {
            RenderSettings.ambientLight = new Color(0.5f, 0.5f, 0.5f);
            var rooms = new List<Vector3>(RoomColumns * RoomRows);

            for (var z = 0; z < RoomRows; z += 1)
            {
                for (var x = 0; x < RoomColumns; x += 1)
                {
                    var position = new Vector3(x * Spacing, 0f, z * Spacing);
                    rooms.Add(position);
                    AddBox(new Vector3(RoomSize, 0.2f, RoomSize), position + new Vector3(0f, -0.1f, 0f), 0f, "BenchmarkBox");
                    AddBox(new Vector3(RoomSize, RoomHeight, WallThickness), position + new Vector3(0f, RoomHeight / 2f, -RoomSize / 2f), 0f, "BenchmarkBox");
                    AddBox(new Vector3(RoomSize, RoomHeight, WallThickness), position + new Vector3(0f, RoomHeight / 2f, RoomSize / 2f), 0f, "BenchmarkBox");
                    AddBox(new Vector3(WallThickness, RoomHeight, RoomSize), position + new Vector3(-RoomSize / 2f, RoomHeight / 2f, 0f), 0f, "BenchmarkBox");
                    AddBox(new Vector3(WallThickness, RoomHeight, RoomSize), position + new Vector3(RoomSize / 2f, RoomHeight / 2f, 0f), 0f, "BenchmarkBox");

                    var index = z * RoomColumns + x;
                    if (index > 0)
                    {
                        AddCorridor(rooms[index - 1], position);
                    }
                }
            }

            var cameraObject = new GameObject("BenchmarkCamera");
            var camera = cameraObject.AddComponent<Camera>();
            cameraObject.transform.position = new Vector3(24f, 38f, 62f);
            cameraObject.transform.LookAt(new Vector3(24f, 0f, 18f));
            camera.fieldOfView = 60f;
            camera.nearClipPlane = 0.1f;
            camera.farClipPlane = 500f;
            camera.clearFlags = CameraClearFlags.SolidColor;
            camera.backgroundColor = new Color(0.063f, 0.063f, 0.078f, 1f);

            var lightObject = new GameObject("DirectionalLight");
            var directional = lightObject.AddComponent<Light>();
            directional.type = LightType.Directional;
            directional.intensity = 0.8f;
            directional.shadows = LightShadows.None;
            lightObject.transform.rotation = Quaternion.Euler(50f, -30f, 0f);
        }

        private void AddBox(Vector3 scale, Vector3 position, float rotationY, string objectName)
        {
            var box = new GameObject(objectName);
            box.transform.position = position;
            box.transform.localScale = scale;
            box.transform.rotation = Quaternion.Euler(0f, rotationY, 0f);

            var filter = box.AddComponent<MeshFilter>();
            filter.sharedMesh = benchmarkCubeMesh;

            var renderer = box.AddComponent<MeshRenderer>();
            renderer.sharedMaterial = benchmarkMaterial;
            renderer.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            renderer.receiveShadows = false;
        }

        private void AddCorridor(Vector3 a, Vector3 b)
        {
            var delta = b - a;
            var length = new Vector2(delta.x, delta.z).magnitude;
            var center = (a + b) * 0.5f;
            var angle = Mathf.Atan2(delta.z, delta.x) * Mathf.Rad2Deg;
            AddBox(
                new Vector3(length, 0.2f, CorridorWidth),
                center + new Vector3(0f, -0.1f, 0f),
                -angle,
                "BenchmarkCorridor"
            );
        }

        private static Mesh CreateCubeMesh()
        {
            var mesh = new Mesh { name = "DAI_Benchmark_Cube" };
            mesh.vertices = new[]
            {
                new Vector3(-0.5f, -0.5f, -0.5f), new Vector3( 0.5f, -0.5f, -0.5f), new Vector3( 0.5f,  0.5f, -0.5f), new Vector3(-0.5f,  0.5f, -0.5f),
                new Vector3(-0.5f, -0.5f,  0.5f), new Vector3( 0.5f, -0.5f,  0.5f), new Vector3( 0.5f,  0.5f,  0.5f), new Vector3(-0.5f,  0.5f,  0.5f)
            };
            mesh.triangles = new[]
            {
                0, 2, 1, 0, 3, 2,
                5, 6, 4, 6, 7, 4,
                4, 7, 0, 7, 3, 0,
                1, 2, 5, 2, 6, 5,
                3, 7, 2, 7, 6, 2,
                4, 0, 5, 0, 1, 5
            };
            mesh.RecalculateNormals();
            mesh.RecalculateBounds();
            mesh.UploadMeshData(true);
            return mesh;
        }

        private IEnumerator MeasureFrames()
        {
            ReportStatus("waiting-first-frame");
            yield return new WaitForEndOfFrame();

            var firstRenderMs = (Time.realtimeSinceStartup - startRealtime) * 1000f;
            ReportStatus("sampling-frames");
            var previous = Time.realtimeSinceStartup;

            while (frameSamplesMs.Count < EffectiveSamples)
            {
                yield return null;
                var now = Time.realtimeSinceStartup;
                frameSamplesMs.Add((now - previous) * 1000f);
                previous = now;
            }

            frameSamplesMs.Sort();

            var median = Percentile(frameSamplesMs, 0.50f);
            var p95 = Percentile(frameSamplesMs, 0.95f);
            var p99 = Percentile(frameSamplesMs, 0.99f);

            var payload = new BenchmarkPayload
            {
                fixtureId = FixtureId,
                renderer = "unity-webgl",
                version = Application.unityVersion,
                objectCount = 119,
                sceneGenerationMs = sceneGenerationMs,
                firstRenderMs = firstRenderMs,
                complete = true,
                failed = false,
                failureMessage = string.Empty,
                sampleCount = frameSamplesMs.Count,
                frameMsMedian = median,
                frameMsP95 = p95,
                frameMsP99 = p99,
                fpsMedian = median > 0f ? 1000f / median : 0f,
                drawCalls = -1,
                triangles = 1428,
                runtimeErrors = runtimeErrors
            };

            ReportStatus("complete");
            ReportPayload(payload);
        }

        private void ReportFailure(Exception error)
        {
            var payload = new BenchmarkPayload
            {
                fixtureId = FixtureId,
                renderer = "unity-webgl",
                version = Application.unityVersion,
                objectCount = 0,
                sceneGenerationMs = sceneGenerationMs,
                firstRenderMs = 0f,
                complete = true,
                failed = true,
                failureMessage = error.ToString(),
                sampleCount = frameSamplesMs.Count,
                frameMsMedian = 0f,
                frameMsP95 = 0f,
                frameMsP99 = 0f,
                fpsMedian = 0f,
                drawCalls = -1,
                triangles = 0,
                runtimeErrors = runtimeErrors
            };

            ReportStatus("failed");
            ReportPayload(payload);
        }

        private static void ReportStatus(string status)
        {
            Debug.Log($"DAI_BENCH_STATUS:{status}");
#if UNITY_WEBGL && !UNITY_EDITOR
            DAI_ReportBenchmarkStatus(status);
#endif
        }

        private static void ReportPayload(BenchmarkPayload payload)
        {
            var json = JsonUtility.ToJson(payload);
#if UNITY_WEBGL && !UNITY_EDITOR
            DAI_ReportBenchmarkJson(json);
#else
            Debug.Log(json);
#endif
        }

        private static float Percentile(List<float> sorted, float p)
        {
            if (sorted.Count == 0)
            {
                return 0f;
            }

            var index = Mathf.Clamp(Mathf.CeilToInt(sorted.Count * p) - 1, 0, sorted.Count - 1);
            return sorted[index];
        }

        [Serializable]
        private sealed class BenchmarkPayload
        {
            public string fixtureId;
            public string renderer;
            public string version;
            public int objectCount;
            public float sceneGenerationMs;
            public float firstRenderMs;
            public bool complete;
            public bool failed;
            public string failureMessage;
            public int sampleCount;
            public float frameMsMedian;
            public float frameMsP95;
            public float frameMsP99;
            public float fpsMedian;
            public int drawCalls;
            public int triangles;
            public int runtimeErrors;
        }
    }
}
