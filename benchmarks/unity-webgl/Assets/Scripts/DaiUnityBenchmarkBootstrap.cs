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

        private readonly List<float> frameSamplesMs = new List<float>(EffectiveSamples);
        private float startRealtime;
        private float sceneGenerationMs;
        private int runtimeErrors;

#if UNITY_WEBGL && !UNITY_EDITOR
        [DllImport("__Internal")]
        private static extern void DAI_ReportBenchmarkJson(string json);
#endif

        private void Awake()
        {
            startRealtime = Time.realtimeSinceStartup;
            Application.targetFrameRate = -1;
            QualitySettings.vSyncCount = 0;
            Application.logMessageReceived += OnLogMessage;

            var generationStart = Time.realtimeSinceStartup;
            BuildFixture();
            sceneGenerationMs = (Time.realtimeSinceStartup - generationStart) * 1000f;

            StartCoroutine(MeasureFrames());
        }

        private void OnDestroy()
        {
            Application.logMessageReceived -= OnLogMessage;
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

            var shader = Shader.Find("Universal Render Pipeline/Lit");
            if (shader == null)
            {
                shader = Shader.Find("Standard");
            }
            if (shader == null)
            {
                throw new InvalidOperationException("No supported benchmark shader was found.");
            }

            var material = new Material(shader)
            {
                color = new Color(0.557f, 0.604f, 0.686f, 1f)
            };

            var rooms = new List<Vector3>(RoomColumns * RoomRows);

            for (var z = 0; z < RoomRows; z += 1)
            {
                for (var x = 0; x < RoomColumns; x += 1)
                {
                    var position = new Vector3(x * Spacing, 0f, z * Spacing);
                    rooms.Add(position);
                    AddBox(material, new Vector3(RoomSize, 0.2f, RoomSize), position + new Vector3(0f, -0.1f, 0f));
                    AddBox(material, new Vector3(RoomSize, RoomHeight, WallThickness), position + new Vector3(0f, RoomHeight / 2f, -RoomSize / 2f));
                    AddBox(material, new Vector3(RoomSize, RoomHeight, WallThickness), position + new Vector3(0f, RoomHeight / 2f, RoomSize / 2f));
                    AddBox(material, new Vector3(WallThickness, RoomHeight, RoomSize), position + new Vector3(-RoomSize / 2f, RoomHeight / 2f, 0f));
                    AddBox(material, new Vector3(WallThickness, RoomHeight, RoomSize), position + new Vector3(RoomSize / 2f, RoomHeight / 2f, 0f));

                    var index = z * RoomColumns + x;
                    if (index > 0)
                    {
                        AddCorridor(material, rooms[index - 1], position);
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

        private static void AddBox(Material material, Vector3 scale, Vector3 position)
        {
            var box = GameObject.CreatePrimitive(PrimitiveType.Cube);
            box.name = "BenchmarkBox";
            box.transform.position = position;
            box.transform.localScale = scale;
            var collider = box.GetComponent<Collider>();
            if (collider != null)
            {
                Destroy(collider);
            }

            var renderer = box.GetComponent<MeshRenderer>();
            renderer.sharedMaterial = material;
            renderer.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            renderer.receiveShadows = false;
        }

        private static void AddCorridor(Material material, Vector3 a, Vector3 b)
        {
            var delta = b - a;
            var length = new Vector2(delta.x, delta.z).magnitude;
            var center = (a + b) * 0.5f;
            var angle = Mathf.Atan2(delta.z, delta.x) * Mathf.Rad2Deg;

            var box = GameObject.CreatePrimitive(PrimitiveType.Cube);
            box.name = "BenchmarkCorridor";
            box.transform.position = center + new Vector3(0f, -0.1f, 0f);
            box.transform.localScale = new Vector3(length, 0.2f, CorridorWidth);
            box.transform.rotation = Quaternion.Euler(0f, -angle, 0f);

            var collider = box.GetComponent<Collider>();
            if (collider != null)
            {
                Destroy(collider);
            }

            var renderer = box.GetComponent<MeshRenderer>();
            renderer.sharedMaterial = material;
            renderer.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            renderer.receiveShadows = false;
        }

        private IEnumerator MeasureFrames()
        {
            yield return new WaitForEndOfFrame();

            var firstRenderMs = (Time.realtimeSinceStartup - startRealtime) * 1000f;
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
                sampleCount = frameSamplesMs.Count,
                frameMsMedian = median,
                frameMsP95 = p95,
                frameMsP99 = p99,
                fpsMedian = median > 0f ? 1000f / median : 0f,
                drawCalls = -1,
                triangles = 1428,
                runtimeErrors = runtimeErrors
            };

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
