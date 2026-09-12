using System;
using System.IO;
using DungeonArchitectAI.Benchmark;
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace DungeonArchitectAI.Benchmark.Editor
{
    public static class DaiUnityBenchmarkBuild
    {
        public static void Build()
        {
            if (Application.unityVersion != "6000.3.23f1")
            {
                throw new InvalidOperationException(
                    $"Unity version mismatch. Expected 6000.3.23f1, got {Application.unityVersion}"
                );
            }

            Directory.CreateDirectory("Assets/Generated");
            AssetDatabase.Refresh();

            const string materialPath = "Assets/Generated/BenchmarkMaterial.mat";
            if (AssetDatabase.LoadAssetAtPath<Material>(materialPath) != null)
            {
                AssetDatabase.DeleteAsset(materialPath);
            }

            var shader = Shader.Find("Unlit/Color");
            if (shader == null)
            {
                shader = Shader.Find("Standard");
            }
            if (shader == null)
            {
                throw new InvalidOperationException("Unity Editor could not resolve a benchmark shader.");
            }

            var material = new Material(shader)
            {
                color = new Color(0.557f, 0.604f, 0.686f, 1f)
            };
            AssetDatabase.CreateAsset(material, materialPath);
            AssetDatabase.SaveAssets();

            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            var root = new GameObject("DAI_Unity_Benchmark");
            var bootstrap = root.AddComponent<DaiUnityBenchmarkBootstrap>();
            bootstrap.BenchmarkMaterial = material;

            var scenePath = "Assets/Generated/Benchmark.unity";
            EditorSceneManager.SaveScene(scene, scenePath);

            PlayerSettings.defaultScreenWidth = 960;
            PlayerSettings.defaultScreenHeight = 540;
            PlayerSettings.runInBackground = true;
            PlayerSettings.WebGL.compressionFormat = WebGLCompressionFormat.Disabled;
            PlayerSettings.WebGL.decompressionFallback = false;

            var output = Environment.GetEnvironmentVariable("DAI_UNITY_BUILD_DIR");
            if (string.IsNullOrWhiteSpace(output))
            {
                output = Path.GetFullPath(Path.Combine("..", "..", ".tmp", "unity-webgl-build"));
            }

            Directory.CreateDirectory(output);

            var report = BuildPipeline.BuildPlayer(new BuildPlayerOptions
            {
                scenes = new[] { scenePath },
                locationPathName = output,
                target = BuildTarget.WebGL,
                options = BuildOptions.None
            });

            if (report.summary.result != BuildResult.Succeeded)
            {
                throw new InvalidOperationException(
                    $"Unity WebGL build failed: {report.summary.result}"
                );
            }

            Debug.Log(
                $"DAI Unity WebGL build succeeded. Output={output}; TotalSize={report.summary.totalSize}"
            );
        }
    }
}
