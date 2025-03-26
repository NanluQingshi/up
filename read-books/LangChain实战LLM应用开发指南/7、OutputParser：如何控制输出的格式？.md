大家好，欢迎继续学习 LangChain 实战课程。

在 LLM 应用开发时，我们通常不会直接将模型生成的答案作为最终结果呈现给用户。相反，模型的输出通常被视为中间步骤，需要进一步的程序处理。

例如，在创建一个智能旅行规划助手时，用户会输入他们的旅行偏好。模型随后会生成一个包含推荐目的地、路线和交通工具等信息的旅行计划文本。接下来，我们会对模型的输出进行格式化，并根据解析出的数据，调用航班、酒店预订和天气预报等相关接口，来进一步完善和细化用户的旅行计划。如下图：

<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/55ad74d0e547444eb7485246e85ec7ed~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1278&h=498&s=47082&e=png&b=fceda3" alt=""  /></p>

为了格式化模型的文本输出，LangChain 设计了一系列`输出解析器`，以满足各种场景的解析需求。至此，**一条比较完整的 LLM 链一般包含三个因素：Prompt 输入、LLM 调用、OutputParser 输出。**

<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/efc1ae03613a482aa366afd04df2d083~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1298&h=764&s=72992&e=png&b=fceda3" alt=""  /></p>


在今天的课程中，我们将首先探讨 LangChain 如何将输出解析器整合到 LLM 链的执行流程中。接着，我们会深入学习各种常见输出解析器的工作原理及其使用方法。这将帮助我们在实际的开发工作中，能够**根据需求挑选出更合适的输出解析器**。

<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/875eae4bd046413dacf9a5b26dbcf7ed~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=2178&h=866&s=139538&e=png&b=ffffff" alt=""  /></p>





## LangChain 中输出解析器设计原理

虽然在描述 LLM 链时，输出解析器处于 LLM 调用之后，但其实，在 LangChain 的设计中，输出解析器在 Prompt 的构建中就已经发挥作用了。

输出解析器的工作原理很简单：**在提示模板中为输出格式保留一个占位符变量，该变量由输出解析器负责填充；LLM 按照输出要求返回文本答案后，再传给输出解析器，解析成预期的数据结构。**

<p align=center><img src="https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/8adca298e4e746eeb5829a3c918d4e55~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1870&h=1058&s=153444&e=png&b=ffffff" alt=""  /></p>

为了满足上面的流程，每个输出解析器都实现了两个方法。

1.  `get_format_instructions`：填充提示模板中输出格式的占位符变量，限制模板返回的文本格式。
2.  `parse`：接收 LLM 返回的文本答案，解析成指定的数据结构。

下面，我们以 LangChain 中的`CommaSeparatedListOutputParser`作为演示，看一条加上输出解析器的 LLM 链长什么样，以及有什么不同的效果。

`CommaSeparatedListOutputParser`是 LangChain 提供的用于返回数组结构的输出解析器。

```python
from langchain.output_parsers import CommaSeparatedListOutputParser
from langchain.prompts import PromptTemplate
from langchain_openai import ChatOpenAI
# 1. 实例化一个 CommaSeparatedListOutputParser对象
output_parser = CommaSeparatedListOutputParser()

format_instructions = output_parser.get_format_instructions()
# 2. 创建一个 prompt template，将 output_parser.get_format_instructions()填充进最终的prompt中
prompt = PromptTemplate(
    template="List five {subject}.\n{format_instructions}",
    input_variables=["subject"],
    partial_variables={"format_instructions": format_instructions},
)
# 3. 创建一个LLM实例
model = ChatOpenAI(temperature=0)
# 4. 构建链
chain = prompt | model | output_parser
```

调用`chain.invoke`，观察 LLM 链返回结果。

```python
print(chain.invoke({"subject": "彩虹颜色"}))
#> List['红色', '橙色', '黄色', '绿色', '蓝色']
```

可以发现，该链返回了一个 python 数组，我们可以直接使用该结果进行后续的逻辑处理。

`CommaSeparatedListOutputParser`是怎么做的呢？我们先看下`CommaSeparatedListOutputParser.get_format_instructions`的实现：

```python
class CommaSeparatedListOutputParser(ListOutputParser):
    ...
    def get_format_instructions(self) -> str:
        return (
            "Your response should be a list of comma separated values, "
            "eg: `foo, bar, baz`"
        )
```

将上述函数返回的字符串拼接到提示模板中：

```python
"""
List five {subject}.
Your response should be a list of comma separated values, eg: `foo, bar, baz`
"""
```


根据上面的提示模板，我们调用 LLM 后会得到一个按逗号隔开的字符串。比如：`'红色', '橙色', '黄色', '绿色', '蓝色'`。

在上面的 LLM 链中，`chain.invoke`会将 LLM 返回的文本字符串传入`output_parser.invoke`（链执行过程中函数的调用传递我们在下一节再详细介绍），而`output_parser.invoke`最终会调用到`output_parser.parse`。

```python
class CommaSeparatedListOutputParser(ListOutputParser):
    ...
    def parse(self, text: str) -> List[str]:
        """Parse the output of an LLM call."""
        return text.strip().split(", ")
```

`parse`函数中，使用 python 的内置函数`split`将字符串转成数组。





## LangChain 常见的输出解析器

除了`CommaSeparatedListOutputParser`，LangChain 还提供了其他多种输出解析器，以满足不同的使用场景。我们将挑选一些生产环境中最常见的解析器，详细介绍它们的使用场景及实现方式。



### DatetimeOutputParser

此 OutputParser 用于将 LLM 输出解析为 python 的`datetime`对象。

示例代码：

```python
from langchain_openai import OpenAI
from langchain.output_parsers import DatetimeOutputParser
from langchain.prompts import PromptTemplate
output_parser = DatetimeOutputParser()
prompt_template = PromptTemplate(
    template="{question}\n{format_instructions}",
    input_variables=["question"],
    partial_variables={"format_instructions": output_parser.get_format_instructions()},
)
model = OpenAI(temperature=0.0)
chain = prompt_template | model
output = chain.invoke({"question": "香港是什么时候回归的"})
# >> 1997-07-01T00:00:00.000000Z
output_parser.parse(output)
# >> datetime{1997-07-01 00:00:00}
```

解析器关键源码实现：

```python
class DatetimeOutputParser(BaseOutputParser[datetime]):
    format: str = "%Y-%m-%dT%H:%M:%S.%fZ"
    def get_format_instructions(self) -> str:
        examples = comma_list(_generate_random_datetime_strings(self.format))
        return (
            f"Write a datetime string that matches the "
            f"following pattern: '{self.format}'.\n\n"
            f"Examples: {examples}\n\n"
            f"Return ONLY this string, no other words!"
        )
     
     def parse(self, response: str) -> datetime:
         ...
         return datetime.strptime(response.strip(), self.format)
        
```

`DatetimeOutputParser`通过变量`format`控制时间格式。

`get_format_instructions`方法中，会按`format`的格式生成一些随机的日期时间字符串作为示例，并与 format 一起作为模型输出的提示指令，确保模型输出符合预期的时间格式文本。返回的字符串如下：

```python
from langchain.output_parsers import DatetimeOutputParser
output_parser = DatetimeOutputParser()
output_parser.get_format_instructions()
"""
Write a datetime string that matches the 
    following pattern: "%Y-%m-%dT%H:%M:%S.%fZ". 
    Examples: 1946-10-14T23:30:26.845253Z, 1392-07-26T13:26:26.557091Z, 1780-08-08T01:24:15.382408Z
"""
```

parse 方法则是将模型的文本响应转换为`datetime` 对象。



### PydanticOutputParser

`Pydantic`是 python 中一个十分强大的库，可以帮助开发者进行字段解析和类型校验。比如，我们都知道 python 不会强校验数据类型，假设我们有一个类 Member：

```python
class Member:
    def __init__(self, name: str, age: int):
        self.name = name
        self.age = age
```

虽然字段 age 定义为 int 类型，但我们给它赋值字符串，也不会报错。

```python
member = Member(name="Jay", age="one")
print(member.age)
# > one
```

这种宽松的约束虽然自由，但同时也增加了程序的不稳定性，有时候甚至会导致崩溃。现在，我们为 `Member` 添加 Pydantic 提供的基类 `BaseModel`，看看有什么效果：

```python
from pydantic import BaseModel
class Member(BaseModel):
    name: str
    age: int

member = Member(name="Jay", age="one")
"""
...
pydantic_core._pydantic_core.ValidationError: 1 validation error for Member
age
  Input should be a valid integer, unable to parse string as an integer [type=int_parsing, input_value='one', input_type=str]
"""
```

可以看到，现在只要赋值的数据类型与定义的不一致，就会抛出异常了。

`PydanticOutputParser`是 LangChain 提供的一个功能非常强大的输出解析器，基于 Pydantic 库，可以将模型输出的结果转成我们自定义的类对象，还能进行一些自定义的校验，确保结果字段符合预期。

示例代码：

```python
from langchain.prompts import PromptTemplate
from langchain_openai import OpenAI
from langchain.output_parsers import PydanticOutputParser
from langchain_core.pydantic_v1 import BaseModel, Field, validator

class Joke(BaseModel):
    setup: str = Field(description="question to set up a joke")
    punchline: str = Field(description="answer to resolve the joke")

    # 检查 setup 字段必须以"?"结尾，会在 parse 生成实例化对象时生效
    @validator("setup")
    def question_ends_with_question_mark(cls, field):
        if field[-1] != "?":
            raise ValueError("Badly formed question!")
        return field

output_parser = PydanticOutputParser(pydantic_object=Joke)
prompt_template = PromptTemplate(
    template="Tell me a joke.\n{format_instructions}",
    input_variables=[],
    partial_variables={"format_instructions": output_parser.get_format_instructions()},
)
llm = OpenAI()
chain = prompt_template | OpenAI()
output = chain.invoke({})
print(output)
# >> {"setup": "Why don't scientists trust atoms?", "punchline": "Because they make up everything."}
print(output_parser.parse(output))
# >> Joke{setup='Why don't scientists trust atoms?' punchline='Because they make up everything.'}
```

  


解析器关键源码实现：

```python
class JsonOutputParser(BaseCumulativeTransformOutputParser[Any]):
    ...
    def parse(self, text: str) -> Any:
        return self.parse_result([Generation(text=text)])
    ...
 
class PydanticOutputParser(JsonOutputParser):
    pydantic_object: Type[BaseModel]
    ...
    def get_format_instructions(self) -> str:
        schema = self.pydantic_object.schema()

        # Remove extraneous fields.
        reduced_schema = schema
        if "title" in reduced_schema:
            del reduced_schema["title"]
        if "type" in reduced_schema:
            del reduced_schema["type"]
        # Ensure json in context is well-formed with double quotes.
        schema_str = json.dumps(reduced_schema)

        return PYDANTIC_FORMAT_INSTRUCTIONS.format(schema=schema_str)
     
     def parse_result(self, result: List[Generation], *, partial: bool = False) -> Any:
         ...
         json_object = super().parse_result(result)
         return self.pydantic_object.parse_obj(json_object)
```

-   `get_format_instructions`

使用`PydanticOutputParser`时，我们需要传入一个继承自`BaseModel`的自定义的类，该自定义类指定了预期的字段名以及字段的描述信息。

在`get_format_instructions`中，会使用 `BaseModel` 的`schema`方法获取类定义 json。以示例中的`Joke`类为例，得到的类定义 json 如下：

```python
{'title': 'Joke', 'type': 'object', 'properties': {'setup': {'title': 'Setup', 'description': 'question to set up a joke', 'type': 'string'}, 'punchline': {'title': 'Punchline', 'description': 'answer to resolve the joke', 'type': 'string'}}, 'required': ['setup', 'punchline']}
```

经过一系列 “裁剪” 后，将该 json 字符串传入`PYDANTIC_FORMAT_INSTRUCTIONS`，`PYDANTIC_FORMAT_INSTRUCTIONS`内容（翻译后）如下：

````python
PYDANTIC_FORMAT_INSTRUCTIONS = """
输出应格式化为符合以下 JSON 模式的 JSON 实例。
例如，对于模式 {{"properties": {{"foo": {{"title": "Foo", "description": "a list of strings", "type": "array", "items": {{"type": "string"}}}}}}, "required": ["foo"]}}，对象 {{"foo": ["bar", "baz"]}} 是该模式的一个格式良好的实例。对象 {{"properties": {{"foo": ["bar", "baz"]}}}} 格式不佳。
以下是输出模式：
```
{schema}
```"""
````

所以，该输出模板将会控制模型返回符合字段信息的 json 字符串。

需要注意的是，自定义类中的字段是`Field`对象，`Field`可以设置字段的多个属性，每个属性都会影响字段的最终输出。

```python
def Field(
    default: Any = Undefined,
    *,
    default_factory: Optional[NoArgAnyCallable] = None,
    alias: Optional[str] = None,
    title: Optional[str] = None,
    description: Optional[str] = None,
    exclude: Optional[Union['AbstractSetIntStr', 'MappingIntStrAny', Any]] = None,
    include: Optional[Union['AbstractSetIntStr', 'MappingIntStrAny', Any]] = None,
    const: Optional[bool] = None,
    gt: Optional[float] = None,
    ge: Optional[float] = None,
    lt: Optional[float] = None,
    le: Optional[float] = None,
    ...
```

其中，`description` 属性极其关键，因为 LLM 是根据这个属性描述返回相应的信息。

  


-   `parse`

`PydanticOutputParser.parse`最终其实调用的是`PydanticOutputParser.parse_result`。

在`PydanticOutputParser.parse_result`中，利用`BaseModel.parse_obj`将模型返回的 json 字符串解析成预期的类对象（`Joke`对象）。

  


### StructuredOutputParser

`PydanticOutputParser`非常强大，但也很复杂，有时候我们只是希望 LLM 能够结构化输出。这种情况下可以使用`StructuredOutputParser`，这个输出解析器设计来用于进行简单的结构输出。

示例代码：

````python
from langchain.output_parsers import ResponseSchema
from langchain.output_parsers import StructuredOutputParser
from langchain_openai import OpenAI
from langchain.prompts import PromptTemplate

response_schemas = [
    ResponseSchema(name="setup", description="question to set up a joke"),
    ResponseSchema(name="punchline",description="answer to resolve the joke")
]
output_parser = StructuredOutputParser.from_response_schemas(response_schemas)
prompt_template = PromptTemplate(     template="Tell me a joke\n{format_instructions}",     input_variables=[],     partial_variables={"format_instructions": output_parser.get_format_instructions()}, )

chain = prompt_template | OpenAI()
output = chain.invoke({})
"""
```json
{
        "setup": "Why don't scientists trust atoms?",
        "punchline": "Because they make up everything."
}
```
"""
output_parser.parse(output)
"""
{
    "setup": "Why don't scientists trust atoms?",
    "punchline": "Because they make up everything."
}
"""
````

解析器关键源码实现：

```python
line_template = '\t"{name}": {type}  // {description}'
...
def _get_sub_string(schema: ResponseSchema) -> str:
    return line_template.format(
        name=schema.name, description=schema.description, type=schema.type
    )
...
class StructuredOutputParser(BaseOutputParser):
    # 定义的字段结构列表
    response_schemas: List[ResponseSchema]

    @classmethod
    def from_response_schemas(
        cls, response_schemas: List[ResponseSchema]
    ) -> StructuredOutputParser:
        return cls(response_schemas=response_schemas)

    def get_format_instructions(self, only_json: bool = False) -> str:
        schema_str = "\n".join(
            [_get_sub_string(schema) for schema in self.response_schemas]
        )
        ...
        return STRUCTURED_FORMAT_INSTRUCTIONS.format(format=schema_str)
    
    def parse(self, text: str) -> Any:
        expected_keys = [rs.name for rs in self.response_schemas]
        # 底层调用json.loads
        return parse_and_check_json_markdown(text, expected_keys)
```

-   `get_format_instructions`

我们使用 LangChain 提供的`ResponseSchema`来定义预期的字段列表，并将该列表传入`StructuredOutputParser.from_response_schemas`，创建一个 `StructuredOutputParser`实例。

在`get_format_instructions`中，会遍历每个`ResponseSchema`对象，按照变量模板`line_template`格式化每个字段。之后，将格式化后的字段字符串填充`STRUCTURED_FORMAT_INSTRUCTIONS`指令模板。

`STRUCTURED_FORMAT_INSTRUCTIONS`定义如下（翻译后）：

````python
STRUCTURED_FORMAT_INSTRUCTIONS = """
输出应该是一个遵循以下模式的 Markdown 代码片段，包括前后的 "```json" 和 "```"：
```json
{{
{format}
}}
```
"""
````

所以，上述例子中的`StructuredOutputParser`最终生成的输出格式控制指令如下：

````python
output_parser.get_format_instructions()
"""
输出应该是一个遵循以下模式的 Markdown 代码片段，包括前后的 "```json" 和 "```"：

```json
{
        "setup": string  // question to set up a joke
        "punchline": string  // answer to resolve the joke
}
```
"""
````

  


-   `parse`

`parse`则将模型输出的 json 字符串，通过`json.loads`格式化成 python 的 `dict` 结构。



### OutputFixingParser

最后再介绍一个比较特殊的输出解析器 —— `OutputFixingParser`，它的作用不是为了格式化输出，而是为了 “修复” 其他输出解析器输出的格式异常。

什么意思呢？以上面`StructuredOutputParser` 里的例子举例，假设 LLM 生成了以下结果：

````python
llm_err_response = """
```json
{
        'setup': 'Why don't scientists trust atoms?',
        'punchline': 'Because they make up everything.'
}
```
"""
````

我们把双引号换成了单引号，这个 json 字符串是不合法的，在 `StructuredOutputParser.parse`的时候会抛异常，这个时候，我们可以使用`OutputFixingParser`尝试修复这个异常。

示例代码：

````python
from langchain.output_parsers import ResponseSchema, StructuredOutputParser,OutputFixingParser
from langchain_openai import OpenAI

#构造业务输出解析器，用于控制LLM输出格式
response_schemas = [
    ResponseSchema(name="setup", description="question to set up a joke"),
    ResponseSchema(name="punchline",description="answer to resolve the joke")
]
structured_output_parser = StructuredOutputParser.from_response_schemas(response_schemas)

# 构造OutputFixingParser实例，用于修复业务输出解析器异常
fixing_output_passer = OutputFixingParser.from_llm(parser=structured_output_parser, llm = OpenAI())
# LLM错误输出
llm_err_response = """
```json
{
        'setup': 'Why don't scientists trust atoms?',
        'punchline': 'Because they make up everything.'
}
```
"""
# 使用业务输出解析器时，由于LLM错误输出，所以在解析时直接抛异常
structured_output_parser.parse(llm_err_response)
"""

langchain_core.exceptions.OutputParserException: Got invalid JSON object. Error: Expecting property name enclosed in double quotes: line 2 column 9 (char 10)
"""

# 使用OutputFixingParser，可以纠正LLM的错误输出，并使用业务解析器去解析纠正后的文本答案。
fixing_output_passer.parse(llm_err_response)
"""
{
    "setup": "Why don't scientists trust atoms?",
    "punchline": "Because they make up everything."
}
"""
````

解析器关键源码实现：

```python
class OutputFixingParser(BaseOutputParser[T]):
    def from_llm(
        cls,
        llm: BaseLanguageModel,
        parser: BaseOutputParser[T],
        prompt: BasePromptTemplate = NAIVE_FIX_PROMPT,
        max_retries: int = 1,
    ) -> OutputFixingParser[T]:
        from langchain.chains.llm import LLMChain
        chain = LLMChain(llm=llm, prompt=prompt)
        return cls(parser=parser, retry_chain=chain, max_retries=max_retries)
        
    def get_format_instructions(self) -> str:
        return self.parser.get_format_instructions()
        
    def parse(self, completion: str) -> T:
        retries = 0
        while retries <= self.max_retries:
            try:
                return self.parser.parse(completion)
            except OutputParserException as e:
                if retries == self.max_retries:
                    raise e
                else:
                    retries += 1
                    completion = self.retry_chain.run(
                        instructions=self.parser.get_format_instructions(),
                        completion=completion,
                        error=repr(e),
                    )
        raise OutputParserException("Failed to parse")
```

-   `from_llm`

`OutputFixingParser`通过`from_llm`创建解析器实例，需要传入一个 LLM 对象和业务预期输出格式的输出解析器，在`from_llm`中，LLM 对象创建了一个新的 LLM 链，赋值给`retry_chain`变量，该链的作用我们后面再说；业务输出解析器被赋值给了`parser`。

-   `get_format_instructions`

直接返回了`self.parser.get_format_instructions()`，也就是说，在控制模型输出格式的指令构造上，`OutputFixingParser`是不起任何作用的。

-   `parse`

LLM 生成结果后，`OutputFixingParser` 先使用`self.parser`去尝试解析，如果解析成功，整个解析流程就完成了。如果解析失败，会使用`from_llm`中创建的`retry_chain`去尝试 “纠正” 错误，最多尝试`max_retries`次。`retry_chain`默认使用的提示模板如下（翻译后）：

```python
NAIVE_FIX = """
指令：
{instructions}
完成：
{completion}
在上面的内容中，完成的内容没有满足指令中给出的约束条件。 错误：
{error}
请再试一次。请仅以满足指令中列出的约束条件的答案作答：
"""
```

`instructions`传入的是`self.parser.get_format_instructions()`，即控制业务预期输出格式的指令字符串。

`completion`传入的是 LLM 返回的异常格式输出文本。

`error`传入的是`self.parser.parse`方法解析 LLM 响应抛出的异常。

  


`OutputFixingParser`就像在业务输出解析器外面多包了一层，通过额外调用 LLM 来修复异常格式的输出，在一定程度上提高 AI 系统的鲁棒性和用户体验；然而，LLM 调用也会导致额外的性能开销。

  


## 总结

1.  输出解析器提供一个控制 LLM 输出格式的指令字符串和一个解析 LLM 输出文本的解析函数，实现了链的结构化输出。
2.  `CommaSeparatedListOutputParser`控制 LLM 输出按逗号分隔的字符串，并将其解析成列表。
3.  `PydanticOutputParser`利用 `Pydantic` 库来解析和验证 LLM 的响应文本，可以输出我们自定义的类对象。
4.  `StructuredOutputParser`可以指定输出字段的名称、类型、描述信息，进行简单的结构化输出。
5.  `OutputFixingParser`通过额外调用 LLM 来修复业务输出解析器的异常输出，提高 AI 系统的鲁棒性和用户体验。

随着 LangChain 的迭代，输出解析器的类型会越来越多，本文仅介绍了其中一部分，更多解析器可参考 LangChain 的[官方文档](https://python.langchain.com/docs/modules/model_io/output_parsers/)。