#!/usr/bin/env swift
// 用途：使用 macOS Vision 框架对截图进行 OCR，提取文字
// 参数：$1 = 图片路径
// 输出：stdout 返回识别到的所有文字
// 退出码：0=成功，1=失败

import Foundation
import Vision
import AppKit

func recognizeText(in imagePath: String) {
    guard let image = NSImage(contentsOfFile: imagePath),
          let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
        print("错误：无法加载图片 \(imagePath)", to: &stderr)
        exit(1)
    }

    let request = VNRecognizeTextRequest { (request, error) in
        guard let observations = request.results as? [VNRecognizedTextObservation] else {
            print("错误：OCR 识别失败", to: &stderr)
            exit(1)
        }

        let text = observations.compactMap { observation in
            observation.topCandidates(1).first?.string
        }.joined(separator: "\n")

        print(text)
        exit(0)
    }

    request.recognitionLevel = .accurate
    request.recognitionLanguages = ["zh-Hans", "zh-Hant", "en-US"]

    let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
    do {
        try handler.perform([request])
    } catch {
        print("错误：\(error.localizedDescription)", to: &stderr)
        exit(1)
    }
}

struct StdErrOutputStream: TextOutputStream {
    mutating func write(_ string: String) {
        FileHandle.standardError.write(string.data(using: .utf8)!)
    }
}
var stderr = StdErrOutputStream()

if CommandLine.arguments.count < 2 {
    print("用法: swift ocr-screenshot.swift <图片路径>", to: &stderr)
    exit(1)
}

recognizeText(in: CommandLine.arguments[1])
RunLoop.main.run()
