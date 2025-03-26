“离线” 是 LLM 本身一个比较明显的缺点，模型只能基于已训练的知识进行回答，对于实时信息或需要与其他系统联动才能获取的信息，它就无能为力了。比如，我们提问：“今天北京天气如何？”，模型虽然知道我们提问的目的，但因为训练集不可能有这类实时信息，模型无法做出准确回答。这就像打战枪里没有子弹了，憋屈得很。


终于，OpenAI 在 2023 年 6 月为其 Chat Model 开放函数调用功能，赋予了模型与万物互联的能力。

上节课我们学习的`RunnableLambda`，在一定程度上也支持了 LLM 与外部系统的交互，但它是否调用是由我们自己控制的，在创建 LLM 链的时候就已经确定好了；而 OpenAI 的函数调用功能，可以利用模型的决策功能，让模型决定是否需要调用函数完成任务。

今天，我们将详细介绍 OpenAI 中函数调用的基本概念和交互流程，并学习 LangChain 如何集成函数调用功能。

<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/f4f39a0b8c6c4c3eb182c79074c08498~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=2088&h=944&s=137284&e=png&b=ffffff" alt=""  /></p>



## 函数调用的交互原理

第一次听到 LLM 支持函数调用的时候，相信很多人会跟我有一样的错觉：以为我们丢一个实现好的函数给模型，然后模型在必要的时候帮我们直接执行。但其实没这么神奇，我们调用模型时，带上我们的函数签名和函数功能描述，模型只是做了下面两件事：

1.  根据用户输入的问题和传入的函数功能描述，决定是否需要调用函数。
2.  如果不需要，则直接返回答案；如果需要，会根据函数签名，从用户输入提取信息并转成函数需要的入参格式，返回给用户。

也就是说，函数还是由我们执行的，模型只是告诉我们需要执行哪个函数，入参分别是什么，我们执行完后，再将结果提交给模型，模型根据结果做出连贯准确的回答。

<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/0a97f618af0a494fa510775e6c18a431~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1076&h=958&s=96962&e=png&b=fefefe" alt=""  /></p>

为了区分用户消息和函数调用结果消息，OpenAI 添加了 `function` 消息类型。当我们调用函数返回结果后，可以将函数结果以 `function` 的角色传给 LLM。

  


## OpenAI 原生 API 函数调用

OpenAI 为函数调用设计特定的数据结构，为了更好地理解函数调用的交互流程，我们直接通过 OpenAI 的原生 API 进行学习。



### OpenAI 原生 API 调用

考虑到之前没有介绍过 OpenAI 原生 API，我们先简单了解下 OpenAI 接口的基本使用。由于函数调用只支持 Chat Model，所以我们主要介绍其聊天模型的调用方法。

```python
from openai import OpenAI
client = OpenAI(api_key=os.environ['OPENAI_API_KEY'], base_url=os.environ['OPENAI_API_BASE'])

completion = client.chat.completions.create(
  model="gpt-3.5-turbo",
  messages=[
    {"role": "system", "content": "你是一个编程专家，从专业的角度回答用户问题"},
    {"role": "user", "content": "什么编程语言最容易？"}
  ]
)
```

我们先创建一个 OpenAI 实例，初始化时可以指定 api_key 和 base_url，所以第三方购买的代理密钥也能够使用。

通过`client.chat.completions.create`方法调用模型，该方法主要传入模型名称和消息列表，消息种类与之前介绍的一致，有`system`、`user`、`assistant`和`function`。

调用模型后，返回内容`completion`如下：

```json
{
  "id": "chatcmpl-93ICiWBkZZrpa08NLFt9LYttQLCj0",
  "choices": [
    {
      "finish_reason": "stop",
      "index": 0,
      "logprobs": null,
      "message": {
        "content": "将哪种编程语言视...",
        "role": "assistant",
        "function_call": null,
        "tool_calls": null
      }
    }
  ],
  "created": 1710571988,
  "model": "gpt-3.5-turbo-0613",
  "object": "chat.completion",
  "system_fingerprint": null,
  "usage": {
    "completion_tokens": 431,
    "prompt_tokens": 41,
    "total_tokens": 472
  }
}
```

其中`choices[0].message`就是模型的响应内容。`usage` 代表本轮对话消耗的 token 数量，这也是一般 LLM 应用的计费数据来源。更多字段介绍可参考[官网](https://platform.openai.com/docs/api-reference/chat/object)。

OK，OpenAI 接口的教学到此为止，现在我们继续函数调用的内容。


### OpenAI 函数调用基本流程

-   **定义业务函数**

第一步，肯定得先定义下我们的业务函数，假设我们有如下获取天气的函数：

```python
def get_weather(date, location):
    print("after query，{}{}'s weather is 20℃".format(date, location))
    return "20℃"
```

-   **创建模型调用工具列表**

`OpenAI.chat.completions.create`方法支持传入一个工具列表，我们可以将业务函数描述 json 对象加入该工具列表中，供模型调用时使用。

```python
tools = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "Get the weather for a specified location on a specified date",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {
                        "type": "string",
                        "description": "The city and state, e.g. 北京"
                    },
                    "date": {
                        "type": "string",
                        "description": "the date to get weather, e.g. 2024-01-01"
                    }
                },
                "required": ["location", "date"]
            }
        }
    }
]
```

| 字段名                            | 字段说明                                                               |
| ------------------------------ | ------------------------------------------------------------------ |
| type                           | 工具的类型。目前仅支持 `function`                                             |
| function                       | 业务函数的描述对象                                                          |
| function.name                  | 业务函数名                                                              |
| function.description           | 对函数功能的描述，模型使用它来选择何时以及如何调用该函数。                                      |
| function.parameters            | 函数接受的参数，当函数不需要传参时，可以将该字段留空                                         |
| function.parameters.type       | 固定为object                                                          |
| function.parameters.properties | 函数参数列表，key 为每个参数名，value 为参数描述对象，模型根据其中的description从用户输入中提取传给函数的参数值 |
| function.parameters.required   | 指定调用函数时哪些参数必传                                                      |

-   **工具列表加入模型调用中**

现在，我们将 `tools` 加入到`OpenAI.chat.completions.create`，看看调用效果。

```python
def get_weather(date, location):
    print("after query，{}{}'s weather is 20℃".format(date, location))
    return "20℃"

tools = [{...}]
messages = []
messages.append({"role": "user", "content": "what's the beijing's weather like in 2024-01-01"})
completion = client.chat.completions.create(
    model="gpt-3.5-turbo-0613",
    messages=messages,
    tools=tools
)
```

```python
print(completion.choices[0].message)
"""
{
    "content": null,
    "role": "assistant",
    "function_call": null,
    "tool_calls": [
      {
        "ChatCompletionMessageToolCall": {
          "id": "call_avmE2kG04Zu813cGCfkR6sSG",
          "function": {
              "arguments": "{"location": "北京", "date": "2024-01-01"}",
              "name": "get_weather"
          },
          "type": "function"
        }
      }
    ]
}
"""
```

可以发现，模型准确推测出需要通过调用函数才能回答用户问题（`message.tool_calls[0].type = "function"`），返回了需要调用的函数（`message.tool_calls[0].function.name = "get_weather`"）以及函数参数列表（`message.tool_calls[0].function.arguments`）。

-   **手动调用函数**

接下来，我们根据模型返回的函数信息调用相应的函数：

```python
...
import json

llm_message = completion.choices[0].message
args = json.loads(llm_message.tool_calls[0].function.arguments)
location = args["location"]
date = args["date"]
temperature = get_weather(date, location)
```

-   **将函数结果传回模型**

很多时候，调用函数后还需要将结果回传给模型，让模型生成更连贯的响应。

我们可以将函数结果以 `function` 的角色传给模型，而且，为了让模型了解上下文，我们需要连带把前一轮对话的用户消息和模型响应一并传给模型。代码如下：

```python
...
# 添加上一轮中的模型响应
messages.append(
    {
        "role": "assistant", 
        "function_call":{
                "name":llm_message.tool_calls[0].function.name,
                "arguments":llm_message.tool_calls[0].function.arguments
        }
    }
)
# 添加函数结果
messages.append({"role": "function", "name": "get_weather", "content": temperature})
# 再次调用模型
completion2 = client.chat.completions.create(
    model="gpt-3.5-turbo-0613",
    messages=messages,
    tools=tools
)
print(completion2.choices[0].message)
"""
{
    "content": "The weather in Beijing on January 1, 2024 is expected to be 20℃.",
    "role": "assistant",
    "function_call": null,
    "tool_calls": null
}
"""
```

可以看到，模型返回了语义化的答案，可以根据具体场景的需求，“调教” LLM 回复的语气或内容格式，生成更满意的回答。



### 函数调用中的 “幻觉”

模型在函数调用中也会存在“幻觉”。有时候模型虽然推测出用户问题需要进行函数调用，但用户提供信息不全，模型有可能会“擅自”推测参数值，返回错误的参数调用传参。比如，上面例子中，我们尝试发起提问：“what's the weather like in 2024-01-01”，即缺失了位置信息，看看模型会如何响应：

```python
messages = []
messages.append({"role": "user", "content": "what's the weather like in 2024-01-01"})
completion = client.chat.completions.create(
    model="gpt-3.5-turbo-0613",
    messages=messages,
    tools=tools
)
print(completion.choices[0].message)
"""
{
    "content": null,
    "role": "assistant",
    "function_call": null,
    "tool_calls": [
    {
        "id": "call_hmAeWUte4t9mqO3QzPGa1jq6",
        "function": {
            "arguments": "{"location": "北京", "date": "2024-01-01"}",
            "name": "get_weather"
        },
        "type": "function"
      }
    ]
}
"""
```

可以看到，模型“擅自”补全了 `location` 参数，这会导致业务函数返回错误结果甚至抛出异常，为了避免这种情况，我们可以从提示技巧入手，对模型处理时添加一些限制，告诉模型在用户输入不全时，要求用户补充缺失的信息。

```python
messages = []
messages.append({"role": "system", "content": "Don't make assumptions about what values to plug into functions. Ask for clarification if a user request is ambiguous."})
messages.append({"role": "user", "content": "what's the weather like in 2024-01-01"})
completion = client.chat.completions.create(
    model="gpt-3.5-turbo-0613",
    messages=messages,
    tools=tools
)
print(completion.choices[0].message)
"""
{
    "content": "Sure, I can help you with that. Can you please tell me the location for which you want to know the weather on January 1, 2024?",
    "role": "assistant",
    "function_call": null,
    "tool_calls": null
}
"""
```

这次，模型不再 “自作主张” 了，遇到不清楚的情况，会提醒用户提供更多信息。

我们添加位置信息，并将上一轮的对话消息一并回传给模型，为模型提供对话的上下文。

```python
messages = []
messages.append({"role": "system", "content": "Don't make assumptions about what values to plug into functions. Ask for clarification if a user request is ambiguous."})
messages.append({"role": "user", "content": "what's the weather like in 2024-01-01"})
messages.append({"role": "assistant", "content": "I'm sorry, I didn't understand that. Can you please tell me the location for which you want to know the weather on January 1, 2024?"})
messages.append({"role": "user", "content": "guangzhou"})
completion = client.chat.completions.create(
    model="gpt-3.5-turbo-0613",
    messages=messages,
    tools=tools
)
print(completion.choices[0].message)
"""
{
    "content": null,
    "role": "assistant",
    "function_call": null,
    "tool_calls": [
        {
            "id": "call_lcHi4TUrV6jDgnCgEkw7lx69",
            "function": {
                "arguments": "{"location": "guangzhou", "date": "2024-01-01"}",
                "name": "get_weather"
            },
            "type": "function"
        }
    ]
}
"""
```

补充了位置信息后，模型根据上下文推断出用户的意图，返回了需要调用的函数及完整的参数列表。

  


### 函数调用进阶使用

-   **强制使用/不使用函数调用**

我们可以通过参数 `tool_choice`强制控制是否进行函数调用。比如，我们可以强制模型使用 `get_weather`函数。

```python
messages = []
messages.append({"role": "system", "content": "Don't make assumptions about what values to plug into functions. Ask for clarification if a user request is ambiguous."})
messages.append({"role": "user", "content": "what's the weather like in 2024-01-01"})
completion = client.chat.completions.create(
    model="gpt-3.5-turbo-0613",
    messages=messages,
    tools=tools,
    # 强制使用get_weather函数
    tool_choice={"type": "function", "function": {"name": "get_weather"}}
)
print(completion.choices[0].message)
"""
{
    "content": null,
    "role": "assistant",
    "function_call": null,
    "tool_calls": [
      {
        "id": "call_2KCnZVFRH3wIaC1ibPQnbgZu",
        "function": {
          "name": "get_weather",
          "arguments": {
            "location": "北京",
            "date": "2024-01-01"
          }
        },
        "type": "function"
      }
    ]
}
"""
```

可以看到，即使用户提供的信息不全，模型也会使用 `get_weather` 函数，模型“被迫”产生错误的函数参数。


当我们明确不需要调用函数时，可以设置`tool_choice="none"`，大家可以自己尝试下，即使输入的问题意图很明确，传入的信息很完整，模型也不会使用函数调用。



-   **并行调用函数**

在一些**较新的模型中（gpt-4-1106-preview 或 gpt-3.5-turbo-1106）**，支持一次性调用多次函数。比如我们一次询问北京多个日期的天气：

```python
messages = []
messages.append({"role": "system", "content": "Don't make assumptions about what values to plug into functions. Ask for clarification if a user request is ambiguous."})
messages.append({"role": "user", "content": "what's the beijing's weather like in 2024-01-01 and 2024-01-02?"})

completion = client.chat.completions.create(
    model="gpt-3.5-turbo-1106",
    messages=messages,
    tools=tools
)
print(completion.choices[0].message)
"""
{
    "content": null,
    "role": "assistant",
    "function_call": null,
    "tool_calls": [
      {
        "id": "call_KJm4bnlpeh1Qwr7UibtQwoxQ",
        "function": {
          "name": "get_weather",
          "arguments": {
            "location": "北京",
            "date": "2024-01-01"
          }
        },
        "type": "function"
      },
      {
        "id": "call_1RZFAWxvtEIDV9yRqsNv3mlU",
        "function": {
          "name": "get_weather",
          "arguments": {
            "location": "北京",
            "date": "2024-01-02"
          }
        },
        "type": "function"
      }
    ]
  }
}
"""
```

`tool_calls`数组中每个元素代表一次函数调用信息，上面模型一次性调用了两次`get_weather`函数，分别查询了北京的两个日期的天气。

需要注意的是，获取到函数结果，在下一次调用模型前，添加 `messages` 时需要注意添加的顺序，需要保证上一轮模型响应中函数调用消息与对应函数调用结果的顺序一致。

```python
...
# 添加上一轮中的模型响应
messages.append({
    "role": "assistant", 
    "function_call":{
        "name":"get_weather",
        "arguments":"{"location": "北京", "date": "2024-01-01"}"
    }
})
messages.append({
    "role": "assistant", 
    "function_call":{
        "name":"get_weather",
        "arguments":"{"location": "北京", "date": "2024-01-02"}"
    }
})
# 添加函数结果,需要注意先添加 2024-01-01 的结果，再添加 2024-01-02 的结果
messages.append({"role": "function", "name": "get_weather", "content": "20℃"})
messages.append({"role": "function", "name": "get_weather", "content": "21℃"})
# 再次调用模型
...
```




## LangChain 中进行函数调用

在上面的函数调用中，其中一个比较麻烦的步骤是根据业务函数构造模型需要的函数描述对象，对比，LangChain 利用 pydantic 库，创建了一种更简便的生成方式。

> pydantic 在[《OutputParser：如何控制模型输出的格式？》](https://juejin.cn/book/7352849785881591823/section/7353077613520240690)章节中已经有简单介绍。



### 创建函数描述 pydantic 类

在 LangChain 中，将业务函数描述为一个继承自 pydantic 的`BaseModel`子类，类的每个字段都使用 pydantic 的 `Field` 进行字段描述和规范。

```python
from langchain_core.pydantic_v1 import BaseModel, Field

class GetWeather(BaseModel):
  """Get the weather for a specified location on a specified date"""
  location: str = Field(description="The city and state, e.g. 北京")
  date: str = Field(description="the date to get weather, e.g. 2024-01-01")
```

上述代码中，特别需要注意的是对`GetWeather`类的注释不能省略，它将作为函数的描述信息。



### 使用函数描述 pydantic 类

**方法一：** **`convert_pydantic_to_openai_function`** **+** **`JsonOutputFunctionsParser`**

LangChain 提供了`convert_pydantic_to_openai_function`方法，可以将上面的 pydantic 类转换为 OpenAI 函数描述对象。

```python
from langchain_community.utils.openai_functions import (
  convert_pydantic_to_openai_function
)

print(convert_pydantic_to_openai_function(GetWeather))
"""
{
    "name": "GetWeather",
    "description": "Get the weather for a specified location on a specified date",
    "parameters": {
        "type": "object",
        "properties": {
            "location": {
                "description": "The city and state, e.g. 北京",
                "type": "string"
            },
            "date": {
                "description": "the date to get weather, e.g. 2024-01-01",
                "type": "string"
            }
        },
        "required": [
            "location",
            "date"
        ]
    }
}
"""
```

可以看到，相比手动构造，`convert_pydantic_to_openai_function`方法可以很方便地生成函数描述对象，包括函数名、描述、参数列表、必填参数等。

生成函数描述对象后，可以通过 `Runnable.bind`方法，将函数描述对象数组传入 `functions` 参数中。

```python
from langchain_openai import ChatOpenAI
chat = ChatOpenAI()
chat.bind(functions=[GetWeather])
```

当模型推测需要调用函数时，LangChain 提供了 `JsonOutputFunctionsParser` 类，可以轻松解析出需要调用的函数及相关传参。

```python
from langchain.output_parsers.openai_functions import JsonOutputFunctionsParser
from langchain_openai import ChatOpenAI
from langchain_community.utils.openai_functions import (
  convert_pydantic_to_openai_function
)

parser = JsonOutputFunctionsParser()
chain = ChatOpenAI().bind(functions=[convert_pydantic_to_openai_function(GetWeather)]) | parser
output = chain.invoke("what's the beijing's weather like in 2024-01-01?")
print(output)
"""
{'location': '北京', 'date': '2024-01-01'}
"""
```



**方法二：** **`bind_tools`** **+** **`JsonOutputToolsParser`**

在 OpenAI 中，定义了`tool`的概念，函数调用只是模型可使用的一种工具（虽然目前也仅有函数调用一种工具），工具类型为 `function`。LangChain 提供了`Runnable.bind_tools`方法，我们可以直接传入准备好的 pydantic 类。一步到位！

```python
from langchain_openai import ChatOpenAI
chat = ChatOpenAI().bind_tools([GetWeather])
```

使用`bind_tools`绑定的模型实例构建的 LLM 链，在解析模型返回的函数调用信息时，需要使用 LangChain 提供的另外一个输出解析器 `JsonOutputToolsParser`。

```python
from langchain.output_parsers.openai_tools import JsonOutputToolsParser
from langchain_openai import ChatOpenAI

parser = JsonOutputToolsParser()
chain = ChatOpenAI().bind_tools([GetWeather]) | parser
output = chain.invoke("what's the beijing's weather like in 2024-01-01?")
print(output)
"""
[{'type': 'GetWeather', 'args': {'location': '北京', 'date': '2024-01-01'}}]
"""
```

## 总结

1.  通过函数调用，可以实现模型调度其他系统，充分利用模型的决策能力，也打破了模型的离线限制。
1.  模型并不会直接执行函数，而是根据用户输入问题，结合传入的函数描述内容，推测是否需要调用函数，返回详细的调用信息（调用的函数名、调用传入的参数）给业务，实际调用还是由业务执行。
1.  函数调用也可能出现“幻觉”，模型在用户提供的信息不完整时可能会“伪造”参数，可以通过提示词进行约束。
1.  LangChain 极大得简化了函数描述对象的构造，并且提供了相关的输出解析器方便解析模型函数调用信息响应。
1.  函数调用需要模型支持，目前越来越多的聊天模型（例如 OpenAI、Gemini 等）提供了函数调用 API。