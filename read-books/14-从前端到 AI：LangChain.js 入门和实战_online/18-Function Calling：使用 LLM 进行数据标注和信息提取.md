> 本章对应源代码：https://github.com/RealKai42/langchainjs-juejin/blob/main/lc-tools.ipynb

上一节中，我们学习了如何直接使用 openAI 的原生 API 去使用 function calling （tools）功能，==**需要自己维护历史、写参数类型并且自己实现函数的调用，确实比较繁琐。**==这一节，我们将学习在 langchain 中如何使用该功能，会极大的减缓使用门槛，并且很容易集成到现有 chain 中。  

同时，我们会讲解几个使用 tools 对数据进行打标签、信息提取等常见的操作
## 在 langchain 中使用 tools
---
在 langchain 中，我们一般会使用 zod 来定义 tool 函数的 JSON schema，我们可以专注在参数的描述上，参数的类型定义和是否 required 都可以有 zod 来生成。 并且在后续定义 Agent tool 时，zod 也能进行辅助的参数类型检测。  

zod 是 js 生态中常见的类型定义和验证的工具库，我们这里用一些例子简单带大家快速入门一下:

首先是简单的使用，我们订一个 string 类型的 schema:

```js
import { z } from "zod";

const stringSchema = z.string();
stringSchema.parse("Hello, Zod!");
```

如果我们传入一个非 string 类型的值：

```js
stringSchema.parse(2323);
```

就会报错

```js
ZodError: [
  {
    "code": "invalid_type",
    "expected": "string",
    "received": "number",
    "path": [],
    "message": "Expected string, received number"
  }
]
```

报错信息的可读性是非常高的，而且也很适合把报错信息传递给 llm，让它自己纠正错误。  

然后，我们用一系列的示例迅速介绍足够我们定义 tool 参数使用的 zod 知识：

```js
// 基础类型
const stringSchema = z.string();
const numberSchema = z.number();
const booleanSchema = z.boolean();

// 数组
const stringArraySchema = z.array(z.string());
stringArraySchema.parse(["apple", "banana", "cherry"]); 

// 对象
const personSchema = z.object({
  name: z.string(),
  age: z.number(),
  // 可选类型
  isStudent: z.boolean().optional(),
  // 默认值
  home: z.string().default("no home")
});

// 联合类型
const mixedTypeSchema = z.union([z.string(), z.number()]);
mixedTypeSchema.parse("hello"); 
mixedTypeSchema.parse(42); 
```

考虑到方便 llm 理解和传递参数，一般不建议定义过于复杂的类型，会让 llm 容易犯错。  

然后，我们就可以用 zod 去定义我们函数参数的 schem，例如以上一节课中获取天气的函数为例：

```js
const getCurrentWeatherSchema = z.object({
  location: z.string().describe("The city and state, e.g. San Francisco, CA"),
  unit: z.enum(["celsius", "fahrenheit"]).describe("The unit of temperature"),
});
```

这里我们定义了两个参数：
- location 是 string 类型，并且添加描述
- unit 是枚举类型，并添加相应的描述

这里我们没有指定 optional，默认就是 required，我们可以使用 `zod-to-json-schema` 去将 zod 定义的 schema 转换成 JSON schema：

```js
import { zodToJsonSchema } from "zod-to-json-schema";

const paramSchema = zodToJsonSchema(getCurrentWeatherSchema)
```

就可以将上面我们定义的 schema 转换成 openAI tools 所需要的 JSON Schema ：

```js
{
  type: "object",
  properties: {
    location: {
      type: "string",
      description: "The city and state, e.g. San Francisco, CA"
    },
    unit: {
      type: "string",
      enum: [ "celsius", "fahrenheit" ],
      description: "The unit of temperature"
    }
  },
  required: [ "location", "unit" ],
  additionalProperties: false,
  "$schema": "http://json-schema.org/draft-07/schema#"
}
```

然后，我们就可以在 model 去使用这个 tool 定义：

```js
const model = new ChatOpenAI({
    temperature: 0 
})

const modelWithTools = model.bind({
    tools: [
        {
            type: "function",
            function: {
                name: "getCurrentWeather",
                description: "Get the current weather in a given location",
                parameters: zodToJsonSchema(getCurrentWeatherSchema),
            }
        }
    ]
})

await modelWithTools.invoke("北京的天气怎么样");
```

这里就会返回一个 AIMessage 信息，并携带着跟 tool call 有关的信息：

```js
AIMessage {
  lc_serializable: true,
  lc_kwargs: {
    content: "",
    additional_kwargs: {
      function_call: undefined,
      tool_calls: [
        {
          function: [Object],
          id: "call_IMLAkWEhmOyh6T9vYMv65uEP",
          type: "function"
        }
      ]
    },
    response_metadata: {}
  },
  lc_namespace: [ "langchain_core", "messages" ],
  content: "",
  name: undefined,
  additional_kwargs: {
    function_call: undefined,
    tool_calls: [
      {
        function: {
          arguments: '{\n  "location": "北京",\n  "unit": "celsius"\n}',
          name: "getCurrentWeather"
        },
        id: "call_IMLAkWEhmOyh6T9vYMv65uEP",
        type: "function"
      }
    ]
  },
  response_metadata: {
    tokenUsage: { completionTokens: 23, promptTokens: 88, totalTokens: 111 },
    finish_reason: "tool_calls"
  }
}
```

跟我们之前直接使用 openai 的 API 的结果是类似的，增加了更多 langchain 内部使用的信息。  

这里的 bind 并不是 model 特有的一个工具，是所有 Runnable 都有的方法，可以将 runnable 需要的参数传入，然后返回一个只需要其他参数的 Runnable 对象。  

因为绑定 tools 后的 model 依旧是 Runnable 对象，所以我们可以很方便的把它加入到 LCEL 链中：

```js
import { ChatPromptTemplate } from "@langchain/core/prompts";

const prompt = ChatPromptTemplate.fromMessages([
    ["system", "You are a helpful assistant"],
    ["human", "{input}"]
])

const chain = prompt.pipe(modelWithTools)

await chain.invoke({
    input: "北京的天气怎么样"
});
```

### 多 tools model
---
同样的，我们也可以在 model 中去绑定多个 tools，就像直接使用 openai 的 API 类似：

```js
const getCurrentTimeSchema = z.object({
  format: z
    .enum(["iso", "locale", "string"])
    .optional()
    .describe("The format of the time, e.g. iso, locale, string"),
});

zodToJsonSchema(getCurrentTimeSchema)
```

注意，这里我们对参数使用了 optional 工具函数，就输出的 json scheme 中就不会将这个参数标志为 required

```js
{
  type: "object",
  properties: {
    format: {
      type: "string",
      enum: [ "iso", "locale", "string" ],
      description: "The format of the time, e.g. iso, locale, string"
    }
  },
  additionalProperties: false,
  "$schema": "http://json-schema.org/draft-07/schema#"
}
```

然后，使用多个 tools 的代码也是类似，`modelWithMultiTools` 就会根据用户的输入和上下文去调用合适的 function：

```js
const model = new ChatOpenAI({
    temperature: 0 
})

const modelWithMultiTools = model.bind({
    tools: [
        {
            type: "function",
            function: {
                name: "getCurrentWeather",
                description: "Get the current weather in a given location",
                parameters: zodToJsonSchema(getCurrentWeatherSchema)
            }
        },
        {
            type: "function",
            function: {
                name: "getCurrentTime",
                description: "Get the current time in a given format",
                parameters: zodToJsonSchema(getCurrentTimeSchema)
            }
        }
    ]
})
```
### 控制 model 对 tools 的调用
---
我们也可以像使用 API 一样通过 `tool_choice` 去控制 llm 调用函数的行为：

```js
model.bind({
    tools: [
        ...
    ],
    tool_choice: "none"
})
```

或者强制调用某个函数:

```js
const modelWithForce = model.bind({
    tools: [
        ...
    ],
    tool_choice: {
        type: "function",
        function: {
           name: "getCurrentWeather"
        }
    }
})
```

## 使用 tools 给数据打标签
---
在数据预处理时，给数据打标签是非常常见的操作。例如之前我们会使用 jieba 这个 python 库对评论进情感打分，找出评论中含有恶意的部分。  

而有了大模型后，跟自然语言相关的绝大部分任务都可以使用 llm 来代替，而且得益于 llm 展现出来非常强大的跨语言理解能力，我们的工具可以是针对任何语言，也可以让 llm 去分辨使用的是什么语言。这些任务在 llm 之前都需要非常复杂的实现才能达到的。  

我们首先定义提取信息的函数 scheme ：

```js
const taggingSchema = z.object({
  emotion:z.enum(["pos", "neg", "neutral"]).describe("文本的情感"),
  language: z.string().describe("文本的核心语言（应为ISO 639-1代码）"),
});
```

这里，我们会核心强调是提取文本中的核心语言，来应对部分中英混杂的情况，如果对语言标记的准确性非常看重，可以在这里加入更多的描述，例如占比 50% 以上的主体语言。  

然后，我们将 tool bind 给 model，注意在 tagging 任务中，需要设置为强制调用这个函数，来保证对任何输入 llm 都会执行 tagging 的函数：

```js
const model = new ChatOpenAI({
    temperature: 0 
})

const modelTagging = model.bind({
    tools: [
        {
            type: "function",
            function: {
                name: "tagging",
                description: "为特定的文本片段打上标签",
                parameters: zodToJsonSchema(taggingSchema)
            }
        }
    ],
    tool_choice: {
        type: "function",
        function: {
           name: "tagging"
        }
    }
})
```

然后，我们使用这个 model 去组合成 chain：

```js
import { JsonOutputToolsParser } from "@langchain/core/output_parsers/openai_tools";

const prompt = ChatPromptTemplate.fromMessages([
    ["system", "仔细思考，你有充足的时间进行严谨的思考，然后按照指示对文本进行标记"],
    ["human", "{input}"]
])

const chain = prompt.pipe(modelTagging).pipe(new JsonOutputToolsParser())
```
这里我们也用到了 system prompt 常用的技巧，就是 “仔细思考” 、“你有充足的时间进行严谨的思考”，有论文验证过，这些词有点像 magic word 一样，加入后就能明显提升输出的质量，越来越玄学了。  


注意这里，我们并没有必要去实现 `taggingSchema` 所对应的函数，因为我们需要的就是 llm 输出的 json 标签，所以我们使用 `JsonOutputToolsParser` 直接拿到 tools 的 json 输出即可。  

我们可以测试一下：

```js
await chain.invoke({
    input: "hello world"
})

// [ { type: "tagging", args: { emotion: "neutral", language: "en" } } ]

await chain.invoke({
    input: "写代码太难了，👴 不干了"
})
// [ { type: "tagging", args: { emotion: "neg", language: "zh" } } ]

await chain.invoke({
    // 日语，圣诞快乐
    input: "メリークリスマス!"
})
// [ { type: "tagging", args: { emotion: "pos", language: "ja" } } ]

await chain.invoke({
    input: "我非常喜欢 AI，特别是 LLM，因为它非常 powerful"
})
// [ { type: "tagging", args: { emotion: "pos", language: "zh" } } ]
```

可以看到，因为我们声明了提取数据中的核心语言，即使是最后一个例子这种混杂的情况，也能提取到正确的信息。  

在这里展现的就是 llm zero-shot learning 的能力，即对于新任务只需要 prompt 的描述，甚至不需要给出任务实例 或者使用一部分数据进行训练，即可以完成任务。  

## 使用 tools 进行信息提取
---
我们再看 tools 另一个常见的应用，信息的提取。信息提取和打标记类似，如果从学术角度可能有一些区别，但在我们实际工程上没必要做太大的区分。感受上就是打标签是给数据打上给定的一些标记，而信息提取是 llm 理解原始文本后提取其中的信息，类似于我们常用的粘贴快递地址，就自动提取姓名、手机和地址一样。  
在信息提取时，一般是会提取多个信息，类似于一段文本中涉及到多个对象的内容，一次性都提取出来。  

让我们先定义描述一个人的信息 scheme：

```js
const personExtractionSchema = z.object({
    name: z.string().describe("人的名字"),
    age: z.number().optional().describe("人的年龄")
}).describe("提取关于一个人的信息");
```

这里 age 我们设计成可选的 number，因为年龄可能是没有的，避免 llm 硬编一个。我们通过对整个 object 添加 describe，让 llm 对整个对象有更多理解。  

然后，我们基于这个去构造更上层的 scheme，从信息中提取更复杂信息：

```js
const relationExtractSchema = z.object({
    people: z.array(personExtractionSchema).describe("提取所有人"),
    relation: z.string().describe("人之间的关系, 尽量简洁")
})
```

这里我们复用 `personExtractionSchema` 去构建数组的 scheme，去提取信息中多人的信息，并且提取文本中人物之间的关系。  

得益于 llm 良好的语言能力，我们只需要有简单的 prompt 就让 llm 在信息提取任务上有很好的表现。我们看一下这个复杂的 scheme 转换后的结果：

```js
const schema = zodToJsonSchema(relationExtractSchema)
```


```json
{
  type: "object",
  properties: {
    people: {
      type: "array",
      items: {
        type: "object",
         properties: {
          name: { type: "string", description: "人的名字" },
          age: { type: "number", description: "人的年龄" }
          },
        required: [ "name" ],
        additionalProperties: false,
        description: "提取关于一个人的信息"
      },
      description: "提取所有人"
    },
    relation: { type: "string", description: "人之间的关系, 尽量简洁" }
  },
  required: [ "people", "relation" ],
  additionalProperties: false,
  "$schema": "http://json-schema.org/draft-07/schema#"
}
```

然后我们把这个 schema 构建成 chain ：

```js
const model = new ChatOpenAI({
    temperature: 0 
})

const modelExtract = model.bind({
    tools: [
        {
            type: "function",
            function: {
                name: "relationExtract",
                description: "提取数据中人的信息和人的关系",
                parameters: zodToJsonSchema(relationExtractSchema)
            }
        }
    ],
    tool_choice: {
        type: "function",
        function: {
           name: "relationExtract"
        }
    }
})

const prompt = ChatPromptTemplate.fromMessages([
    ["system", "仔细思考，你有充足的时间进行严谨的思考，然后提取文中的相关信息，如果没有明确提供，请不要猜测，可以仅提取部分信息"],
    ["human", "{input}"]
])

const chain = prompt.pipe(modelExtract).pipe(new JsonOutputToolsParser())
```

这里 prompt 设计，我们使用 `仔细思考，你有充足的时间进行严谨的思考` 去增强 llm 输出的质量，然后用 `如果没有明确提供，请不要猜测，可以仅提取部分信息` 来减少 llm 的幻想问题。

然后我们先测试一下简单的任务：

```js
await chain.invoke({
    input: "小明现在 18 岁了，她妈妈是小丽"
})
```


```js
[
  {
    type: "relationExtract",
    args: {
      people: [ { name: "小明", age: 18 }, { name: "小丽", age: null } ],
      relation: "小丽是小明的妈妈"
    }
  }
]
```

这里数据中并没有小丽的年龄，所以 llm 直接留空，并没有强行提取信息。  

因为 llm 是根据自己对语言的理解能力，而不是根据传统的匹配规则等，所以在语意中隐含的信息也有良好的提取能力：

```js
await chain.invoke({
    input: "我是小明现在 18 岁了，我和小 A、小 B 是好朋友，都一样大"
})
```


```js
[
  {
    type: "relationExtract",
    args: {
      people: [
        { name: "小明", age: 18 },
        { name: "小A", age: 18 },
        { name: "小B", age: 18 }
      ],
      relation: "小明是小A和小B的好朋友"
    }
  }
]
```

对于 edge case，也有较好的处理效果：

```js
await chain.invoke({
    input: "我是小明"
})
```


```js
[
  {
    type: "relationExtract",
    args: { people: [ { name: "小明", age: null } ], relation: "" }
  }
]
```

## 小结
---
这一节我们学习了如何在 langchain 中使用 openAI tools，通过 zod 减少了我们编写 schema 的繁琐。更重要的，我们学习了如何使用 tools 对数据进行打标签和数据提取，这意味着 llm 并不只是一个 chat bot 的用处，我们可以把他融入在日常的很多数据处理任务中，替代传统很多需要复杂编码才能解决的问题。  
