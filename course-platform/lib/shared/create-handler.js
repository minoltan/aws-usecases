"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createHandler = createHandler;
const aws_cdk_lib_1 = require("aws-cdk-lib");
const aws_lambda_1 = require("aws-cdk-lib/aws-lambda");
const aws_lambda_nodejs_1 = require("aws-cdk-lib/aws-lambda-nodejs");
const path_1 = require("path");
/**
 * Wraps NodejsFunction with this repo's plain-ESM-JS handler convention:
 * src/handlers/<domain>/<name>/index.js, each with its own package.json.
 */
function createHandler(scope, id, props) {
    const { domain, name, environment, ...overrides } = props;
    return new aws_lambda_nodejs_1.NodejsFunction(scope, id, {
        runtime: aws_lambda_1.Runtime.NODEJS_22_X,
        entry: (0, path_1.join)(__dirname, '../../src/handlers', domain, name, 'index.js'),
        timeout: aws_cdk_lib_1.Duration.seconds(30),
        memorySize: 256,
        bundling: {
            minify: true,
            sourceMap: true,
            format: aws_lambda_nodejs_1.OutputFormat.ESM,
            banner: "import { createRequire } from 'module';const require = createRequire(import.meta.url);",
            externalModules: [],
        },
        ...overrides,
        environment: {
            NODE_OPTIONS: '--enable-source-maps',
            ...environment,
        },
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY3JlYXRlLWhhbmRsZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJjcmVhdGUtaGFuZGxlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQWlCQSxzQ0FvQkM7QUFyQ0QsNkNBQXVDO0FBQ3ZDLHVEQUFpRDtBQUNqRCxxRUFBa0c7QUFFbEcsK0JBQTRCO0FBUzVCOzs7R0FHRztBQUNILFNBQWdCLGFBQWEsQ0FBQyxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFtQjtJQUM3RSxNQUFNLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRSxXQUFXLEVBQUUsR0FBRyxTQUFTLEVBQUUsR0FBRyxLQUFLLENBQUM7SUFDMUQsT0FBTyxJQUFJLGtDQUFjLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRTtRQUNuQyxPQUFPLEVBQUUsb0JBQU8sQ0FBQyxXQUFXO1FBQzVCLEtBQUssRUFBRSxJQUFBLFdBQUksRUFBQyxTQUFTLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRSxVQUFVLENBQUM7UUFDdEUsT0FBTyxFQUFFLHNCQUFRLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztRQUM3QixVQUFVLEVBQUUsR0FBRztRQUNmLFFBQVEsRUFBRTtZQUNSLE1BQU0sRUFBRSxJQUFJO1lBQ1osU0FBUyxFQUFFLElBQUk7WUFDZixNQUFNLEVBQUUsZ0NBQVksQ0FBQyxHQUFHO1lBQ3hCLE1BQU0sRUFBRSx3RkFBd0Y7WUFDaEcsZUFBZSxFQUFFLEVBQUU7U0FDcEI7UUFDRCxHQUFHLFNBQVM7UUFDWixXQUFXLEVBQUU7WUFDWCxZQUFZLEVBQUUsc0JBQXNCO1lBQ3BDLEdBQUcsV0FBVztTQUNmO0tBQ0YsQ0FBQyxDQUFDO0FBQ0wsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IER1cmF0aW9uIH0gZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0IHsgUnVudGltZSB9IGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xuaW1wb3J0IHsgTm9kZWpzRnVuY3Rpb24sIE5vZGVqc0Z1bmN0aW9uUHJvcHMsIE91dHB1dEZvcm1hdCB9IGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEtbm9kZWpzJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuaW1wb3J0IHsgam9pbiB9IGZyb20gJ3BhdGgnO1xuXG5leHBvcnQgaW50ZXJmYWNlIEhhbmRsZXJQcm9wcyBleHRlbmRzIFBhcnRpYWw8Tm9kZWpzRnVuY3Rpb25Qcm9wcz4ge1xuICAvKiogTWljcm9zZXJ2aWNlIGRvbWFpbiBmb2xkZXIgdW5kZXIgc3JjL2hhbmRsZXJzLywgZS5nLiAnY291cnNlLWNhdGFsb2cnLiAqL1xuICBkb21haW46IHN0cmluZztcbiAgLyoqIEhhbmRsZXIgZm9sZGVyIG5hbWUgdW5kZXIgc3JjL2hhbmRsZXJzLzxkb21haW4+LywgZS5nLiAnY3JlYXRlQ291cnNlJy4gKi9cbiAgbmFtZTogc3RyaW5nO1xufVxuXG4vKipcbiAqIFdyYXBzIE5vZGVqc0Z1bmN0aW9uIHdpdGggdGhpcyByZXBvJ3MgcGxhaW4tRVNNLUpTIGhhbmRsZXIgY29udmVudGlvbjpcbiAqIHNyYy9oYW5kbGVycy88ZG9tYWluPi88bmFtZT4vaW5kZXguanMsIGVhY2ggd2l0aCBpdHMgb3duIHBhY2thZ2UuanNvbi5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUhhbmRsZXIoc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IEhhbmRsZXJQcm9wcyk6IE5vZGVqc0Z1bmN0aW9uIHtcbiAgY29uc3QgeyBkb21haW4sIG5hbWUsIGVudmlyb25tZW50LCAuLi5vdmVycmlkZXMgfSA9IHByb3BzO1xuICByZXR1cm4gbmV3IE5vZGVqc0Z1bmN0aW9uKHNjb3BlLCBpZCwge1xuICAgIHJ1bnRpbWU6IFJ1bnRpbWUuTk9ERUpTXzIyX1gsXG4gICAgZW50cnk6IGpvaW4oX19kaXJuYW1lLCAnLi4vLi4vc3JjL2hhbmRsZXJzJywgZG9tYWluLCBuYW1lLCAnaW5kZXguanMnKSxcbiAgICB0aW1lb3V0OiBEdXJhdGlvbi5zZWNvbmRzKDMwKSxcbiAgICBtZW1vcnlTaXplOiAyNTYsXG4gICAgYnVuZGxpbmc6IHtcbiAgICAgIG1pbmlmeTogdHJ1ZSxcbiAgICAgIHNvdXJjZU1hcDogdHJ1ZSxcbiAgICAgIGZvcm1hdDogT3V0cHV0Rm9ybWF0LkVTTSxcbiAgICAgIGJhbm5lcjogXCJpbXBvcnQgeyBjcmVhdGVSZXF1aXJlIH0gZnJvbSAnbW9kdWxlJztjb25zdCByZXF1aXJlID0gY3JlYXRlUmVxdWlyZShpbXBvcnQubWV0YS51cmwpO1wiLFxuICAgICAgZXh0ZXJuYWxNb2R1bGVzOiBbXSxcbiAgICB9LFxuICAgIC4uLm92ZXJyaWRlcyxcbiAgICBlbnZpcm9ubWVudDoge1xuICAgICAgTk9ERV9PUFRJT05TOiAnLS1lbmFibGUtc291cmNlLW1hcHMnLFxuICAgICAgLi4uZW52aXJvbm1lbnQsXG4gICAgfSxcbiAgfSk7XG59XG4iXX0=